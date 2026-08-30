import { Injectable } from '@angular/core';
import { ParamMap } from '@angular/router';
import { Game, GameCell, GridSize } from '@common/game';
import {
    DEFAULT_GAME_TURN_COUNTDOWN,
    DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN,
    GameSessionCountdownMode,
    GameSessionMessage,
    GameSessionPhase,
    GameSessionPlayer,
    GameSessionState,
} from '@common/game-session';
import { RoomState } from '@common/wait-room';

type GamePageRouteContext = {
    roomId: string;
    gameId: string;
    playerId: string;
};

export type JournalEntryView = {
    message: GameSessionMessage;
    involvedPlayerNamesLabel: string;
};

@Injectable({
    providedIn: 'root',
})
export class GamePageStateService {
    getRouteContext(queryParamMap: ParamMap): GamePageRouteContext {
        return {
            roomId: queryParamMap.get('room') ?? '',
            gameId: queryParamMap.get('gameId') ?? '',
            playerId: queryParamMap.get('playerId') ?? '',
        };
    }

    matchesRoom(room: RoomState | null, roomId: string): room is RoomState {
        return !!room && room.roomId === roomId;
    }

    matchesSession(session: GameSessionState | null, roomId: string): session is GameSessionState {
        return !!session && session.roomId === roomId;
    }

    normalizeGame(game: Game): Game {
        return { ...game, size: Number(game.size) as GridSize };
    }

    getMissingGameErrors(): string[] {
        return ['Aucun jeu associe a cette partie.'];
    }

    getBoardGridSize(session: GameSessionState | null, game: Game | null): GridSize {
        return session?.gridSize ?? game?.size ?? GridSize.Small;
    }

    getBoardCells(session: GameSessionState | null, game: Game | null): GameCell[] {
        return session?.cells ?? game?.cells ?? [];
    }

    getMapSizeLabel(session: GameSessionState | null, game: Game | null): string {
        if (session) {
            return `${session.gridSize} x ${session.gridSize}`;
        }

        return game ? `${game.size} x ${game.size}` : '-';
    }

    getSessionPhase(session: GameSessionState | null): GameSessionPhase {
        return session?.phase ?? 'turn';
    }

    getSessionCountdownMode(session: GameSessionState | null): GameSessionCountdownMode {
        const countdownMode = session?.countdownMode;
        if (countdownMode) {
            return countdownMode;
        }

        return this.getSessionPhase(session) === 'transition' ? 'transition' : 'turn';
    }

    getEffectiveCountdownMode(session: GameSessionState | null, socketId: string): GameSessionCountdownMode {
        const countdownMode = this.getSessionCountdownMode(session);
        if (countdownMode !== 'combat') {
            return countdownMode;
        }

        const combatPlayerIds = session?.countdownCombatPlayerIds ?? [];
        return combatPlayerIds.includes(socketId) ? 'combat' : 'disabled';
    }

    canEndTurn(session: GameSessionState | null, currentPlayer: GameSessionPlayer | null, activePlayer: GameSessionPlayer | null): boolean {
        if (this.isCombatActive(session)) {
            return false;
        }

        return this.getSessionPhase(session) === 'turn' && !!currentPlayer && activePlayer?.id === currentPlayer.id && !currentPlayer.hasAbandoned;
    }

    canPrimeAction(session: GameSessionState | null, currentPlayer: GameSessionPlayer | null, activePlayer: GameSessionPlayer | null): boolean {
        return this.canEndTurn(session, currentPlayer, activePlayer) && (currentPlayer?.actionsLeft ?? 0) > 0;
    }

    canRequestTurnEnd(session: GameSessionState | null, currentPlayer: GameSessionPlayer | null, activePlayer: GameSessionPlayer | null): boolean {
        if (this.isCombatActive(session)) {
            return false;
        }

        if (this.canEndTurn(session, currentPlayer, activePlayer)) {
            return true;
        }

        if (!currentPlayer || this.getSessionPhase(session) !== 'turn' || currentPlayer.hasAbandoned) {
            return false;
        }

        const player = session?.players.find(({ id }) => id === currentPlayer.id);
        return !!session?.debugMode && (player?.isHost ?? false);
    }

    canToggleDebug(session: GameSessionState | null, currentPlayer: GameSessionPlayer | null): boolean {
        if (!currentPlayer) {
            return false;
        }

        const player = session?.players.find(({ id }) => id === currentPlayer.id);
        return (player?.isHost ?? false) && !currentPlayer.hasAbandoned;
    }

    shouldToggleDebugShortcut(event: KeyboardEvent): boolean {
        return event.key.toLowerCase() === 'm' && !this.isEditableTarget(event.target);
    }

    shouldTeleportOnRightClick(
        session: GameSessionState | null,
        currentPlayer: GameSessionPlayer | null,
        activePlayer: GameSessionPlayer | null,
    ): boolean {
        return this.canEndTurn(session, currentPlayer, activePlayer) && !!session?.debugMode;
    }

    getCountdownSeconds(session: GameSessionState | null): number {
        if (session?.turnRemainingSeconds !== undefined) {
            return session.turnRemainingSeconds;
        }

        return this.getSessionCountdownMode(session) === 'transition' ? DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN : DEFAULT_GAME_TURN_COUNTDOWN;
    }

    getJournalEntries(messages: GameSessionMessage[], players: GameSessionPlayer[]): JournalEntryView[] {
        return [...messages]
            .sort((firstMessage, secondMessage) => firstMessage.createdAt.localeCompare(secondMessage.createdAt))
            .map((message) => ({
                message,
                involvedPlayerNamesLabel: this.getJournalEntryPlayersLabel(message, players),
            }));
    }

    getJournalEntryTypeLabel(message: GameSessionMessage): string {
        if (message.type === 'combat') {
            return 'Combat prive';
        }

        if (message.eventType === 'flag') {
            return 'Drapeau';
        }

        if (message.eventType === 'sanctuary') {
            return 'Sanctuaire';
        }

        if (message.eventType === 'door') {
            return 'Porte';
        }

        return 'Journal';
    }

    getCurrentPlayerName(currentPlayer: GameSessionPlayer | null): string {
        return currentPlayer?.name ?? '';
    }

    isCurrentPlayerAbandoned(currentPlayer: GameSessionPlayer | null): boolean {
        return currentPlayer?.hasAbandoned ?? false;
    }

    normalizeActionPrimed(actionPrimed: boolean, canPrimeAction: boolean): boolean {
        return canPrimeAction ? actionPrimed : false;
    }

    getViewState(
        session: GameSessionState | null,
        actionPrimed: boolean,
        canPrimeAction: boolean,
    ): {
        countdownSeconds: number;
        debugMode: boolean;
        messages: GameSessionMessage[];
        actionPrimed: boolean;
    } {
        return {
            countdownSeconds: this.getCountdownSeconds(session),
            debugMode: session?.debugMode ?? false,
            messages: session?.messages ?? [],
            actionPrimed: this.normalizeActionPrimed(actionPrimed, canPrimeAction),
        };
    }

    private isEditableTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) {
            return false;
        }

        const tagName = target.tagName.toLowerCase();
        return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
    }

    private isCombatActive(session: GameSessionState | null): boolean {
        return this.getSessionCountdownMode(session) === 'combat';
    }

    private getJournalEntryPlayersLabel(message: GameSessionMessage, players: GameSessionPlayer[]): string {
        const involvedPlayerNames = (message.involvedPlayerIds ?? [])
            .map((playerId) => players.find((player) => player.id === playerId)?.name)
            .filter((playerName): playerName is string => !!playerName);

        const uniquePlayerNames = [...new Set(involvedPlayerNames)];
        if (uniquePlayerNames.length === 0) {
            return '';
        }

        return uniquePlayerNames.length === 1 ? `Joueur: ${uniquePlayerNames[0]}` : `Joueurs: ${uniquePlayerNames.join(', ')}`;
    }
}
