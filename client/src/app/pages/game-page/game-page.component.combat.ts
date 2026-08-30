import { Directive } from '@angular/core';
import {
    CombatPosture,
    CombatTurnResult,
    DEFENSIVE_POSTURE_DEFENSE_BONUS,
    ICE_TILE_COMBAT_PENALTY,
    OFFENSIVE_POSTURE_ATTACK_BONUS,
} from '@common/combat';
import { TileId } from '@common/game';
import { GameSessionPlayer, GameSessionState } from '@common/game-session';
import {
    COMBAT_OVERLAY_EXIT_DURATION_MS,
    COMBAT_RESULT_DISPLAY_DURATION_MS,
    GamePageComponentState,
    SPECTATOR_COMBAT_NOTIFICATION_DURATION_MS,
    TURN_TRANSITION_NOTIFICATION_DURATION_MS,
} from './game-page.component.state';
import { buildTransitionNotificationKey } from './game-page.component.utils';

interface CombatWinnerResult {
    winnerId: string;
    winnerName: string;
    isTie: boolean;
}

type CombatRole = 'attacker' | 'defender';

@Directive()
export abstract class GamePageComponentCombat extends GamePageComponentState {
    get shouldShowCombatSpectatorBanner(): boolean {
        return this.isSpectatingCombat(this.session);
    }

    get combatSpectatorBannerLabel(): string {
        return this.getCombatSpectatorLabel(this.session);
    }

    get combatOverlayAttackerName(): string {
        return this.getCombatOverlayPlayerName('attacker');
    }

    get combatOverlayDefenderName(): string {
        return this.getCombatOverlayPlayerName('defender');
    }

    get combatOverlayTurnNumber(): number {
        return this.session?.combatState?.currentTurnNumber ?? 0;
    }

    get combatOverlayAttackerAvatarUrl(): string {
        return this.getCombatOverlayPlayerAvatarUrl('attacker');
    }

    get combatOverlayDefenderAvatarUrl(): string {
        return this.getCombatOverlayPlayerAvatarUrl('defender');
    }

    get combatOverlayAttackerDiceResult(): number {
        return this.latestCombatRound?.attackerToDefender.attackerAttackDiceRoll ?? 0;
    }

    get combatOverlayAttackerAttackBase(): number {
        return this.latestCombatRound?.attackerToDefender.attackerAttackBase ?? 0;
    }

    get combatOverlayAttackerAttackPenalty(): number {
        return this.latestCombatRound?.attackerToDefender.attackerAttackPenalty ?? this.getCombatOverlayTerrainPenalty('attacker');
    }

    get combatOverlayAttackerDefenseBase(): number {
        return this.latestCombatRound?.defenderToAttacker.defenderDefenseBase ?? 0;
    }

    get combatOverlayAttackerDefensePenalty(): number {
        return this.latestCombatRound?.defenderToAttacker.defenderDefensePenalty ?? this.getCombatOverlayTerrainPenalty('attacker');
    }

    get combatOverlayAttackerDefenseDiceResult(): number {
        return this.latestCombatRound?.defenderToAttacker.defenderDefenseDiceRoll ?? 0;
    }

    get combatOverlayAttackerHealth(): number {
        return this.getCombatOverlayPlayer('attacker')?.health ?? 0;
    }

    get combatOverlayAttackerMaxHealth(): number {
        return this.getCombatOverlayPlayer('attacker')?.maxHealth ?? 0;
    }

    get combatOverlayDefenderDiceResult(): number {
        return this.latestCombatRound?.defenderToAttacker.attackerAttackDiceRoll ?? 0;
    }

    get combatOverlayDefenderAttackBase(): number {
        return this.latestCombatRound?.defenderToAttacker.attackerAttackBase ?? 0;
    }

    get combatOverlayDefenderAttackPenalty(): number {
        return this.latestCombatRound?.defenderToAttacker.attackerAttackPenalty ?? this.getCombatOverlayTerrainPenalty('defender');
    }

    get combatOverlayDefenderDefenseBase(): number {
        return this.latestCombatRound?.attackerToDefender.defenderDefenseBase ?? 0;
    }

    get combatOverlayDefenderDefensePenalty(): number {
        return this.latestCombatRound?.attackerToDefender.defenderDefensePenalty ?? this.getCombatOverlayTerrainPenalty('defender');
    }

    get combatOverlayDefenderDefenseDiceResult(): number {
        return this.latestCombatRound?.attackerToDefender.defenderDefenseDiceRoll ?? 0;
    }

    get combatOverlayDefenderHealth(): number {
        return this.getCombatOverlayPlayer('defender')?.health ?? 0;
    }

    get combatOverlayDefenderMaxHealth(): number {
        return this.getCombatOverlayPlayer('defender')?.maxHealth ?? 0;
    }

    get combatOverlayAttackerAttackPostureBonus(): number {
        return this.getCombatOverlayPostureBonus('attacker', 'attack');
    }

    get combatOverlayAttackerDefensePostureBonus(): number {
        return this.getCombatOverlayPostureBonus('attacker', 'defense');
    }

    get combatOverlayDefenderAttackPostureBonus(): number {
        return this.getCombatOverlayPostureBonus('defender', 'attack');
    }

    get combatOverlayDefenderDefensePostureBonus(): number {
        return this.getCombatOverlayPostureBonus('defender', 'defense');
    }

    get combatOverlayAttackerAttackTotal(): number {
        return this.latestCombatRound?.attackerToDefender.attackerAttackTotal ?? 0;
    }

    get combatOverlayAttackerDefenseTotal(): number {
        return this.latestCombatRound?.defenderToAttacker.defenderDefenseTotal ?? 0;
    }

    get combatOverlayDefenderAttackTotal(): number {
        return this.latestCombatRound?.defenderToAttacker.attackerAttackTotal ?? 0;
    }

    get combatOverlayDefenderDefenseTotal(): number {
        return this.latestCombatRound?.attackerToDefender.defenderDefenseTotal ?? 0;
    }

    get combatOverlayAttackerDamageTaken(): number {
        return this.latestCombatRound?.defenderToAttacker.damageDealt ?? 0;
    }

    get combatOverlayDefenderDamageTaken(): number {
        return this.latestCombatRound?.attackerToDefender.damageDealt ?? 0;
    }

    getCombatWinsLabel(combatsWon: number): string {
        return `${combatsWon} ${combatsWon > 1 ? 'victoires' : 'victoire'}`;
    }

    protected syncCombatOverlayVisibility(): void {
        if (this.isCombatOverlayVisible) {
            if (this.combatOverlayUnmountTimeout) {
                clearTimeout(this.combatOverlayUnmountTimeout);
                this.combatOverlayUnmountTimeout = null;
            }
            this.isCombatOverlayExiting = false;
            this.isCombatOverlayRendered = true;
            return;
        }

        if (!this.isCombatOverlayRendered || this.isCombatOverlayExiting) {
            return;
        }

        this.isCombatOverlayExiting = true;
        this.combatOverlayUnmountTimeout = setTimeout(() => {
            this.isCombatOverlayRendered = false;
            this.isCombatOverlayExiting = false;
            this.combatOverlayUnmountTimeout = null;
        }, COMBAT_OVERLAY_EXIT_DURATION_MS);
    }

    protected syncCombatResultMessage(previousSession: GameSessionState | null, currentSession: GameSessionState): void {
        const previousCombatState = previousSession?.combatState;
        const currentCombatState = currentSession.combatState;
        if (!previousCombatState || currentCombatState) {
            return;
        }

        // Let the dedicated game-over popup handle end-of-match messaging.
        if (currentSession.winnerPlayerId || currentSession.winnerPlayerIds?.length) {
            return;
        }

        const isCombatParticipant = this.currentUserId === previousCombatState.attackerId || this.currentUserId === previousCombatState.defenderId;
        if (!isCombatParticipant) {
            return;
        }

        const result = this.resolveCombatResult(previousSession, currentSession, previousCombatState.attackerId, previousCombatState.defenderId);
        if (!result) {
            return;
        }

        const isGameWinner = !result.isTie && currentSession.winnerPlayerId === result.winnerId;
        this.showCombatResult(result.winnerId, result.winnerName, isGameWinner, result.isTie);
    }

    protected dismissCombatResultMessage(): void {
        if (this.combatResultHideTimeout) {
            clearTimeout(this.combatResultHideTimeout);
            this.combatResultHideTimeout = null;
        }

        this.showCombatResultMessage = false;
        this.combatResultWinnerId = '';
        this.combatResultWinnerName = '';
        this.combatResultIsGameWinner = false;
        this.combatResultIsTie = false;
        this.syncCombatOverlayVisibility();
    }

    protected notifyTurnTransitionIfNeeded(): void {
        if (this.session?.winnerPlayerId || this.session?.winnerPlayerIds?.length) {
            this.lastTransitionNotificationKey = null;
            return;
        }

        if (this.effectiveCountdownMode !== 'transition') {
            this.lastTransitionNotificationKey = null;
            return;
        }

        const activePlayerName = this.activePlayer?.name ?? 'personne';
        const notificationKey = buildTransitionNotificationKey(this.roomId, this.activePlayer?.id);
        if (this.lastTransitionNotificationKey === notificationKey) {
            return;
        }

        this.lastTransitionNotificationKey = notificationKey;
        this.notificationService.info(`C'est bientot au tour de ${activePlayerName}.`, {
            duration: TURN_TRANSITION_NOTIFICATION_DURATION_MS,
            horizontalPosition: 'center',
            verticalPosition: 'top',
        });
    }

    protected notifySpectatorCombatIfNeeded(session: GameSessionState | null): void {
        const combatNotificationKey = this.buildSpectatorCombatNotificationKey(session);
        if (!combatNotificationKey) {
            this.lastSpectatorCombatNotificationKey = null;
            return;
        }

        if (this.lastSpectatorCombatNotificationKey === combatNotificationKey) {
            return;
        }

        this.lastSpectatorCombatNotificationKey = combatNotificationKey;
        this.notificationService.warning(this.getCombatSpectatorLabel(session), {
            duration: SPECTATOR_COMBAT_NOTIFICATION_DURATION_MS,
            horizontalPosition: 'center',
            verticalPosition: 'top',
        });
    }

    protected isSpectatingCombat(session: GameSessionState | null): boolean {
        const combatState = session?.combatState;
        if (!combatState || session.countdownMode !== 'combat') {
            return false;
        }

        const socketId = this.roomSocketService.socketId;
        return socketId !== combatState.attackerId && socketId !== combatState.defenderId;
    }

    protected getCombatSpectatorLabel(session: GameSessionState | null): string {
        const combatState = session?.combatState;
        if (!combatState || !session) {
            return 'Combat en cours';
        }

        const attackerName = session.players.find((player) => player.id === combatState.attackerId)?.name ?? 'Un joueur';
        const defenderName = session.players.find((player) => player.id === combatState.defenderId)?.name ?? 'Un joueur';
        return `Combat en cours : ${attackerName} contre ${defenderName}`;
    }

    private resolveCombatResult(
        previousSession: GameSessionState | null,
        currentSession: GameSessionState,
        attackerId: string,
        defenderId: string,
    ): CombatWinnerResult | null {
        const attackerPrevious = previousSession?.players.find((player) => player.id === attackerId);
        const defenderPrevious = previousSession?.players.find((player) => player.id === defenderId);
        const attackerCurrent = currentSession.players.find((player) => player.id === attackerId);
        const defenderCurrent = currentSession.players.find((player) => player.id === defenderId);

        const winnerCandidate = [
            { winnerId: attackerId, previous: attackerPrevious, current: attackerCurrent },
            { winnerId: defenderId, previous: defenderPrevious, current: defenderCurrent },
        ].find((candidate) => (candidate.current?.combatsWon ?? 0) > (candidate.previous?.combatsWon ?? 0));

        if (winnerCandidate) {
            return {
                winnerId: winnerCandidate.winnerId,
                winnerName: winnerCandidate.current?.name ?? 'Un joueur',
                isTie: false,
            };
        }

        return {
            winnerId: '',
            winnerName: '',
            isTie: true,
        };
    }

    private showCombatResult(winnerId: string, winnerName: string, isGameWinner: boolean, isTie = false): void {
        this.combatResultWinnerId = winnerId;
        this.combatResultWinnerName = winnerName;
        this.combatResultIsGameWinner = isGameWinner;
        this.combatResultIsTie = isTie;
        this.showCombatResultMessage = true;

        if (this.combatResultHideTimeout) {
            clearTimeout(this.combatResultHideTimeout);
        }

        this.combatResultHideTimeout = setTimeout(() => {
            this.combatResultHideTimeout = null;
            this.dismissCombatResultMessage();
        }, COMBAT_RESULT_DISPLAY_DURATION_MS);
    }

    private buildSpectatorCombatNotificationKey(session: GameSessionState | null): string | null {
        if (!this.isSpectatingCombat(session) || !session?.combatState) {
            return null;
        }

        return `${session.roomId}:${session.combatState.attackerId}:${session.combatState.defenderId}`;
    }

    private getCombatOverlayPlayerName(role: CombatRole): string {
        const fallbackName = role === 'attacker' ? 'Attaquant' : 'Defenseur';
        const player = this.getCombatOverlayPlayer(role);
        if (!player) {
            return fallbackName;
        }

        return player.name;
    }

    private getCombatOverlayPlayerAvatarUrl(role: CombatRole): string {
        return this.getCombatOverlayPlayer(role)?.avatar.imageUrl ?? '';
    }

    private getCombatOverlayPlayer(role: CombatRole): GameSessionPlayer | null {
        const combatState = this.session?.combatState;
        if (!combatState || !this.session) {
            return null;
        }

        const playerId = role === 'attacker' ? combatState.attackerId : combatState.defenderId;
        return this.session.players.find((player) => player.id === playerId) ?? null;
    }

    private getCombatOverlayPostureBonus(role: CombatRole, attribute: 'attack' | 'defense'): number {
        const combatState = this.session?.combatState;
        const posture = role === 'attacker' ? combatState?.attackerPosture : combatState?.defenderPosture;

        if (posture === CombatPosture.Offensive && attribute === 'attack') {
            return OFFENSIVE_POSTURE_ATTACK_BONUS;
        }

        if (posture === CombatPosture.Defensive && attribute === 'defense') {
            return DEFENSIVE_POSTURE_DEFENSE_BONUS;
        }

        return 0;
    }

    private getCombatOverlayTerrainPenalty(role: CombatRole): number {
        const player = this.getCombatOverlayPlayer(role);
        if (!player || !this.session) {
            return 0;
        }

        const playerCell = this.session.cells.find((cell) => cell.row === player.position.row && cell.column === player.position.column);
        return playerCell?.tile === TileId.Ice ? ICE_TILE_COMBAT_PENALTY : 0;
    }

    private get latestCombatRound(): { attackerToDefender: CombatTurnResult; defenderToAttacker: CombatTurnResult } | null {
        const combatState = this.session?.combatState;
        const turnsHistory = combatState?.turnsHistory;
        if (!combatState || !turnsHistory || turnsHistory.length < 2) {
            return null;
        }

        const attackerToDefender = this.findLatestCombatTurnResult(turnsHistory, combatState.attackerId, combatState.defenderId);
        const defenderToAttacker = this.findLatestCombatTurnResult(turnsHistory, combatState.defenderId, combatState.attackerId);

        if (!attackerToDefender || !defenderToAttacker) {
            return null;
        }

        return { attackerToDefender, defenderToAttacker };
    }

    private findLatestCombatTurnResult(turnsHistory: CombatTurnResult[], attackerId: string, defenderId: string): CombatTurnResult | null {
        for (let index = turnsHistory.length - 1; index >= 0; index--) {
            const turnResult = turnsHistory[index];
            if (turnResult.attackerId === attackerId && turnResult.defenderId === defenderId) {
                return turnResult;
            }
        }

        return null;
    }
}
