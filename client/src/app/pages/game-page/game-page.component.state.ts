import { Directive, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GameGridCell, GameGridPlayerMarker, GamePageCountdownState } from '@app/interfaces/game';
import { GamePageMovementService } from '@app/services/displacement/game-page-movement.service';
import { GamePagePlayerService } from '@app/services/displacement/game-page-player.service';
import { GameClientService } from '@app/services/game-client.service';
import { GamePageDisplayService } from '@app/services/game-page-display.service';
import { GamePageInspectionService } from '@app/services/game-page-inspection.service';
import { GamePageStateService } from '@app/services/game-page-state.service';
import { NotificationService } from '@app/services/notifications/notification.service';
import { RoomSocketService } from '@app/services/room-socket.service';
import { Game, GridSize, Mode, ObjectId } from '@common/game';
import {
    DEFAULT_GAME_TURN_COUNTDOWN,
    FlagTransferRequestPayload,
    GameSessionCountdownMode,
    GameSessionMessage,
    GameSessionPlayer,
    GameSessionState,
} from '@common/game-session';
import { RoomState } from '@common/wait-room';
import { Subscription } from 'rxjs';

export const GAME_PAGE_RETURN_TO_MAIN_KEY = 'game-page-return-to-main';
export const GAME_OVER_REDIRECT_DELAY_MS = 5000;
export const TURN_TRANSITION_NOTIFICATION_DURATION_MS = 3000;
export const SPECTATOR_COMBAT_NOTIFICATION_DURATION_MS = 4500;
export const COMBAT_OVERLAY_EXIT_DURATION_MS = 320;
export const COMBAT_RESULT_DISPLAY_DURATION_MS = 3000;

export type GameOverStatus = 'win' | 'loss' | 'info';
export type MessagesTab = 'chat' | 'journal';

export type PendingSanctuaryChoice = {
    row: number;
    column: number;
    shrineId?: string;
    object: ObjectId.Heal | ObjectId.Combat;
};

@Directive()
export abstract class GamePageComponentState {
    protected readonly route = inject(ActivatedRoute);
    protected readonly router = inject(Router);
    protected readonly roomSocketService = inject(RoomSocketService);
    protected readonly gameClientService = inject(GameClientService);
    readonly gamePagePlayerService = inject(GamePagePlayerService);
    readonly gamePageDisplayService = inject(GamePageDisplayService);
    readonly gamePageInspectionService = inject(GamePageInspectionService);
    readonly gamePageMovementService = inject(GamePageMovementService);
    readonly gamePageStateService = inject(GamePageStateService);
    protected readonly notificationService = inject(NotificationService);

    roomId = '';
    gameId = '';
    currentUserId = '';
    currentUserName = '';
    room: RoomState | null = null;
    session: GameSessionState | null = null;
    game: Game | null = null;
    currentPlayer: GameSessionPlayer | null = null;
    errors: string[] = [];
    countdownSeconds = DEFAULT_GAME_TURN_COUNTDOWN;
    actionPrimed = false;
    debugMode = false;
    messages: GameSessionMessage[] = [];
    activeMessagesTab: MessagesTab = 'chat';
    inspectedCell: GameGridCell | null = null;
    inspectionPopoverPosition = { left: 0, top: 0 };
    isGameOverPopupVisible = false;
    gameOverStatus: GameOverStatus = 'loss';
    isAbandonConfirmVisible = false;
    isHelpModalVisible = false;
    gameOverPopupMessage = '';
    pendingSanctuaryChoice: PendingSanctuaryChoice | null = null;
    isCombatOverlayRendered = false;
    isCombatOverlayExiting = false;
    showCombatResultMessage = false;
    combatResultWinnerId = '';
    combatResultWinnerName = '';
    combatResultIsGameWinner = false;
    combatResultIsTie = false;
    pendingFlagTransferRequest: FlagTransferRequestPayload | null = null;

    protected readonly subscriptions = new Subscription();
    protected hasHandledGameOver = false;
    protected gameOverRedirectTimeout: ReturnType<typeof setTimeout> | null = null;
    protected combatOverlayUnmountTimeout: ReturnType<typeof setTimeout> | null = null;
    protected combatResultHideTimeout: ReturnType<typeof setTimeout> | null = null;
    protected lastTransitionNotificationKey: string | null = null;
    protected lastSpectatorCombatNotificationKey: string | null = null;
    protected hasSignaledRoomDeparture = false;
    protected isNavigatingToEndGame = false;

    get boardGridSize(): GridSize {
        return this.gamePageStateService.getBoardGridSize(this.session, this.game);
    }

    get boardCells() {
        return this.gamePageStateService.getBoardCells(this.session, this.game);
    }

    get boardPlayers(): GameGridPlayerMarker[] {
        const players = this.session?.players ?? [];
        const activePlayerId = this.activePlayer?.id;

        return players
            .filter((player) => !player.hasAbandoned)
            .map((player) => ({
                id: player.id,
                name: player.name,
                row: player.position.row,
                column: player.position.column,
                avatarImageUrl: this.getInGameAvatarImageUrl(player.avatar.imageUrl),
                isActive: player.id === activePlayerId,
                team: player.team,
            }));
    }

    get isCtfMode(): boolean {
        return this.room?.mode === Mode.CTF || this.game?.mode === Mode.CTF;
    }

    get currentPlayerInGameAvatarUrl(): string {
        return this.getInGameAvatarImageUrl(this.currentPlayer?.avatar.imageUrl);
    }

    get reachableBoardCells(): GameGridCell[] {
        if (!this.canEndTurn || !this.currentPlayer || !this.session || this.boardCells.length === 0) {
            return [];
        }

        return this.gamePageMovementService.getReachableCells(this.boardCells, this.session, this.currentPlayer);
    }

    get mapSizeLabel(): string {
        return this.gamePageStateService.getMapSizeLabel(this.session, this.game);
    }

    get activePlayer(): GameSessionPlayer | null {
        return this.gamePagePlayerService.getActivePlayer(this.session);
    }

    get orderedPlayers(): GameSessionPlayer[] {
        return this.gamePagePlayerService.getOrderedPlayers(this.session);
    }

    get currentPlayersCount(): number {
        return this.gamePagePlayerService.getCurrentPlayersCount(this.session, this.room);
    }

    get maxPlayersCount(): number {
        return this.room?.maxPlayers ?? this.session?.players.length ?? this.currentPlayersCount;
    }

    get countdownValueLabel(): string {
        return this.gamePageDisplayService.formatCountdownValue(this.effectiveCountdownMode, this.countdownSeconds);
    }

    get countdownState(): GamePageCountdownState {
        return this.gamePageDisplayService.getCountdownState(this.effectiveCountdownMode, this.countdownSeconds);
    }

    get countdownLabel(): string {
        return this.gamePageDisplayService.getCountdownLabel(this.effectiveCountdownMode);
    }

    get countdownContextLabel(): string {
        return this.gamePageDisplayService.getCountdownContextLabel(this.effectiveCountdownMode, this.activePlayer);
    }

    get canEndTurn(): boolean {
        return this.gamePageStateService.canEndTurn(this.session, this.currentPlayer, this.activePlayer);
    }

    get canPrimeAction(): boolean {
        return this.gamePageStateService.canPrimeAction(this.session, this.currentPlayer, this.activePlayer);
    }

    get canRequestTurnEnd(): boolean {
        return this.gamePageStateService.canRequestTurnEnd(this.session, this.currentPlayer, this.activePlayer);
    }

    get canToggleDebug(): boolean {
        return this.gamePageStateService.canToggleDebug(this.session, this.currentPlayer);
    }

    protected get effectiveCountdownMode(): GameSessionCountdownMode {
        return this.gamePageStateService.getEffectiveCountdownMode(this.session, this.roomSocketService.socketId);
    }

    get inspectedPlayer(): GameGridPlayerMarker | null {
        if (!this.inspectedCell) {
            return null;
        }
        return this.boardPlayers.find((player) => player.row === this.inspectedCell?.row && player.column === this.inspectedCell?.column) ?? null;
    }

    get isCombatOverlayVisible(): boolean {
        const combatState = this.session?.combatState;
        if (!combatState || this.session?.countdownMode !== 'combat') {
            return false;
        }

        const socketId = this.roomSocketService.socketId;
        return socketId === combatState.attackerId || socketId === combatState.defenderId;
    }

    get shouldRenderCombatOverlay(): boolean {
        return this.isCombatOverlayVisible || this.isCombatOverlayRendered;
    }

    get effectiveCurrentPlayerId(): string {
        return this.currentUserId || this.roomSocketService.socketId;
    }

    get gameOverTitle(): string {
        switch (this.gameOverStatus) {
            case 'win':
                return 'Félicitations !';
            case 'info':
                return 'Partie interrompue';
            default:
                return 'Défaite';
        }
    }

    protected getInGameAvatarImageUrl(imageUrl: string | undefined): string {
        if (!imageUrl) {
            return '';
        }

        if (imageUrl.includes('-in-game.')) {
            return imageUrl;
        }

        return imageUrl.replace(/(\.[a-zA-Z0-9]+)$/, '-in-game$1');
    }
}
