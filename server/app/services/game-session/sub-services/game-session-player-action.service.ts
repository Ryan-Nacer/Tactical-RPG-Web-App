import { PlayerService } from '@app/services/player/player.service';
import { CombatPosture } from '@common/combat';
import { Mode } from '@common/game';
import {
    GameSessionPlayer,
    GameSessionState,
    GridPosition,
    MovePlayerPayload,
    SanctuaryActionMode,
    TeleportPlayerPayload,
} from '@common/game-session';
import { buildSystemMessage } from '@app/services/game-session/utils/game-session-message.factory';
import { appendSessionMessage, tryToggleDoor, updateVisitedTiles } from '@app/services/game-session/utils/game-session-runtime.util';
import { GameSessionTurnHooks, GameSessionTurnService } from '@app/services/game-session/utils/game-session-turn.service';
import { GameSessionCombatHooks, GameSessionCombatService } from './game-session-combat.service';
import { GameSessionCtfHooks, GameSessionCtfService } from './game-session-ctf.service';
import { GameSessionSanctuaryHooks, GameSessionSanctuaryService } from './game-session-sanctuary.service';

const ACTIONS_PER_TURN = 1;

export interface GameSessionPlayerActionHooks {
    getMode: (roomId: string) => Mode | undefined;
    getCombatHooks: () => GameSessionCombatHooks;
    getCtfHooks: () => GameSessionCtfHooks;
    getTurnHooks: () => GameSessionTurnHooks;
    getSanctuaryHooks: () => GameSessionSanctuaryHooks;
    emitSessionUpdate: (roomId: string, session: GameSessionState) => void;
}

export class GameSessionPlayerActionService {
    constructor(
        private readonly playerService: PlayerService,
        private readonly combatService: GameSessionCombatService,
        private readonly ctfService: GameSessionCtfService,
        private readonly sanctuaryService: GameSessionSanctuaryService,
        private readonly turnService: GameSessionTurnService,
    ) {}

    performAction(
        roomId: string,
        playerId: string,
        payload: GridPosition & { sanctuaryMode?: SanctuaryActionMode },
        session: GameSessionState,
        hooks: GameSessionPlayerActionHooks,
    ): GameSessionState {
        const activePlayer = session.players.find((player) => player.id === session.activePlayerId);
        if (!this.canAct(session, activePlayer, playerId)) {
            return session;
        }

        const target: GridPosition = { row: payload.row, column: payload.column };

        if (tryToggleDoor(session, activePlayer, target, hooks.getMode(roomId))) {
            this.finishAction(session, activePlayer, roomId, hooks);
            return session;
        }

        if (this.tryUseSanctuary(session, activePlayer, target, payload.sanctuaryMode, hooks)) {
            this.finishAction(session, activePlayer, roomId, hooks);
            return session;
        }

        if (
            this.ctfService.tryExchangeFlagWithTeammate(
                { roomId, mode: hooks.getMode(roomId), session, activePlayer, target },
                hooks.getCtfHooks(),
            )
        ) {
            this.finishAction(session, activePlayer, roomId, hooks);
            return session;
        }

        const targetPlayer = this.playerService.tryPerformCombatAction(session, playerId, target);
        if (!targetPlayer) {
            return session;
        }

        const defender = session.players.find((player) => !player.hasAbandoned && player.id === targetPlayer.id);
        if (!defender) {
            return session;
        }

        if (!this.ctfService.canTriggerCombatBetween(hooks.getMode(roomId), activePlayer, defender)) {
            appendSessionMessage(
                session,
                buildSystemMessage(
                    `Impossible de lancer un combat contre un allie en mode CTF (${defender.name}).`,
                    'generic',
                    [activePlayer, defender],
                ),
            );
            hooks.emitSessionUpdate(roomId, session);
            return session;
        }

        activePlayer.actionsLeft -= ACTIONS_PER_TURN;
        this.combatService.startCombat(session, activePlayer.id, targetPlayer.id, hooks.getCombatHooks());
        hooks.emitSessionUpdate(roomId, session);
        return session;
    }

    chooseCombatPosture(
        roomId: string,
        playerId: string,
        posture: CombatPosture,
        session: GameSessionState,
        hooks: GameSessionPlayerActionHooks,
    ): GameSessionState {
        if (!session.combatState || session.countdownMode !== 'combat') {
            return session;
        }

        const { attackerId, defenderId } = session.combatState;
        if (playerId !== attackerId && playerId !== defenderId) {
            return session;
        }

        if (playerId === attackerId) {
            session.combatState.attackerPosture = posture;
        } else {
            session.combatState.defenderPosture = posture;
        }

        if (session.combatState.attackerPosture && session.combatState.defenderPosture) {
            this.combatService.resolveCombatRound(session, hooks.getCombatHooks());
        }

        hooks.emitSessionUpdate(roomId, session);
        return session;
    }

    movePlayer(
        roomId: string,
        playerId: string,
        payload: Pick<MovePlayerPayload, 'row' | 'column'>,
        session: GameSessionState,
        hooks: GameSessionPlayerActionHooks,
    ): GameSessionState {
        const activePlayer = session.players.find((player) => player.id === session.activePlayerId);
        const hasMoved = this.playerService.tryMoveActivePlayer(session, playerId, payload);
        if (!hasMoved) {
            if (session.phase === 'turn' && activePlayer && activePlayer.id === playerId && !activePlayer.hasAbandoned) {
                this.turnService.completeTurnIfNoOptions(session, activePlayer, hooks.getTurnHooks());
                hooks.emitSessionUpdate(roomId, session);
            }
            return session;
        }

        if (activePlayer && this.handlePostMoveEffects(roomId, session, activePlayer, hooks)) {
            return session;
        }

        hooks.emitSessionUpdate(roomId, session);
        return session;
    }

    teleportPlayer(
        roomId: string,
        playerId: string,
        payload: Pick<TeleportPlayerPayload, 'row' | 'column'>,
        session: GameSessionState,
        hooks: GameSessionPlayerActionHooks,
    ): GameSessionState {
        if (!session.debugMode) {
            return session;
        }

        const hasTeleported = this.playerService.tryTeleportActivePlayer(session, playerId, payload);
        if (!hasTeleported) {
            return session;
        }

        const activePlayer = session.players.find((player) => player.id === session.activePlayerId);
        if (activePlayer && this.handlePostMoveEffects(roomId, session, activePlayer, hooks)) {
            return session;
        }

        hooks.emitSessionUpdate(roomId, session);
        return session;
    }

    private canAct(session: GameSessionState, activePlayer: GameSessionPlayer | undefined, playerId: string): boolean {
        return (
            session.phase === 'turn' &&
            !!activePlayer &&
            activePlayer.id === playerId &&
            !activePlayer.hasAbandoned &&
            activePlayer.actionsLeft > 0
        );
    }

    private finishAction(
        session: GameSessionState,
        activePlayer: GameSessionPlayer,
        roomId: string,
        hooks: GameSessionPlayerActionHooks,
    ): void {
        activePlayer.actionsLeft -= ACTIONS_PER_TURN;
        this.turnService.completeTurnIfNoOptions(session, activePlayer, hooks.getTurnHooks());
        hooks.emitSessionUpdate(roomId, session);
    }

    private handlePostMoveEffects(
        roomId: string,
        session: GameSessionState,
        activePlayer: GameSessionPlayer,
        hooks: GameSessionPlayerActionHooks,
    ): boolean {
        updateVisitedTiles(activePlayer);
        this.ctfService.tryPickUpFlag(hooks.getMode(roomId), session, activePlayer, hooks.getCtfHooks());

        if (this.ctfService.checkCtfWinCondition(roomId, hooks.getMode(roomId), session, activePlayer, hooks.getCtfHooks())) {
            return true;
        }

        this.turnService.completeTurnIfNoOptions(session, activePlayer, hooks.getTurnHooks());
        return false;
    }

    private tryUseSanctuary(
        session: GameSessionState,
        activePlayer: GameSessionPlayer,
        target: GridPosition,
        sanctuaryMode: SanctuaryActionMode | undefined,
        hooks: GameSessionPlayerActionHooks,
    ): boolean {
        return this.sanctuaryService.tryUseSanctuary(session, activePlayer, target, sanctuaryMode, hooks.getSanctuaryHooks());
    }
}