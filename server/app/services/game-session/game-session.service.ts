import { Games } from '@app/model/database/game';
import { CombatResolutionService } from '@app/services/combat/combat-resolution.service';
import { PlayerService } from '@app/services/player/player.service';
import { CombatPosture } from '@common/combat';
import { GridSize, Mode, ObjectId } from '@common/game';
import {
    CombatEndPayload,
    DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN,
    GameSessionPlayer,
    GameSessionState,
    GridPosition,
    MovePlayerPayload,
    SanctuaryActionMode,
    TeleportPlayerPayload,
} from '@common/game-session';
import { PlayerType } from '@common/player';
import { RoomState } from '@common/wait-room';
import { Injectable } from '@nestjs/common';
import { GameSessionAbandonService } from './sub-services/game-session-abandon.service';
import { GameSessionCombatService } from './sub-services/game-session-combat.service';
import { GameSessionCtfService, PendingFlagTransfer } from './sub-services/game-session-ctf.service';
import { GameSessionHooksFactoryService } from './sub-services/game-session-hooks-factory.service';
import { GameSessionPlayerActionService } from './sub-services/game-session-player-action.service';
import { GameSessionSanctuaryService } from './sub-services/game-session-sanctuary.service';
import { cloneSessionCell } from './utils/game-session-grid.helper';
import { buildSystemMessage, filterMessagesForPlayerView } from './utils/game-session-message.factory';
import { shuffleArrayCopy, sortPlayersBySpeedDescending } from './utils/game-session-player-order.util';
import { appendSessionMessage, dropFlagOnDefeatTile, updateVisitedTiles } from './utils/game-session-runtime.util';
import { GameSessionTurnService } from './utils/game-session-turn.service';
const ONE_SECOND_MS = 1000;
const TURN_ORDER_STEP = 1;
@Injectable()
export class GameSessionService {
    private readonly sessions = new Map<string, GameSessionState>();
    private readonly sessionModes = new Map<string, Mode>();
    private readonly updateCallbacks = new Map<string, (session: GameSessionState) => void>();
    private readonly combatEndCallbacks = new Map<string, (payload: CombatEndPayload) => void>();
    private readonly countdownIntervals = new Map<string, NodeJS.Timeout>();
    private readonly countdownLastTickMs = new Map<string, number>();
    private readonly randomThreshold = 0.5;
    private readonly playerSpawns = new Map<string, { row: number; column: number }>();
    private readonly pendingFlagTransfers = new Map<string, PendingFlagTransfer>();
    private readonly gameSessionCombatService: GameSessionCombatService;
    private readonly gameSessionSanctuaryService: GameSessionSanctuaryService;
    private readonly gameSessionCtfService: GameSessionCtfService;
    private readonly gameSessionTurnService: GameSessionTurnService;
    private readonly gameSessionAbandonService: GameSessionAbandonService;
    private readonly gameSessionPlayerActionService: GameSessionPlayerActionService;
    private readonly gameSessionHooksFactoryService: GameSessionHooksFactoryService;
    constructor(
        private readonly playerService: PlayerService,
        private readonly combatResolutionService: CombatResolutionService,
    ) {
        this.gameSessionCombatService = new GameSessionCombatService(this.combatResolutionService);
        this.gameSessionSanctuaryService = new GameSessionSanctuaryService(Math.random, this.randomThreshold);
        this.gameSessionCtfService = new GameSessionCtfService();
        this.gameSessionTurnService = new GameSessionTurnService(this.playerService, this.gameSessionSanctuaryService);
        this.gameSessionAbandonService = new GameSessionAbandonService();
        this.gameSessionPlayerActionService = new GameSessionPlayerActionService(
            this.playerService,
            this.gameSessionCombatService,
            this.gameSessionCtfService,
            this.gameSessionSanctuaryService,
            this.gameSessionTurnService,
        );
        this.gameSessionHooksFactoryService = new GameSessionHooksFactoryService({
            combatService: this.gameSessionCombatService,
            ctfService: this.gameSessionCtfService,
            turnService: this.gameSessionTurnService,
            getMode: (roomId) => this.sessionModes.get(roomId),
            getSpawnPosition: (playerId) => this.playerSpawns.get(playerId),
            emitSessionUpdate: (roomId, session) => this.emitSessionUpdate(roomId, session),
            removeSession: (roomId) => this.removeSession(roomId),
            emitCombatEnd: (payload) => this.emitCombatEnd(payload),
            hasPendingTransfer: (roomId) => this.pendingFlagTransfers.has(roomId),
            getPendingTransfer: (roomId) => this.pendingFlagTransfers.get(roomId),
            setPendingTransfer: (roomId, transfer) => this.pendingFlagTransfers.set(roomId, transfer),
            clearPendingTransfer: (roomId) => this.pendingFlagTransfers.delete(roomId),
        });
    }
    createSession(
        room: RoomState,
        game: Games,
        onSessionUpdate: (session: GameSessionState) => void,
        onCombatEnd?: (payload: CombatEndPayload) => void,
    ): GameSessionState {
        this.removeSession(room.roomId);
        const sortedPlayers = sortPlayersBySpeedDescending(room.players, Math.random, this.randomThreshold);
        const startCells = game.cells.filter((cell) => cell.object === ObjectId.Start);
        if (startCells.length < sortedPlayers.length) {
            throw new Error('Pas assez de cases de depart pour les joueurs');
        }
        const shuffledStarts = shuffleArrayCopy(startCells);
        sortedPlayers.forEach((player, index) => {
            const start = shuffledStarts[index];
            this.playerSpawns.set(player.id, { row: start.row, column: start.column });
        });
        const players: GameSessionPlayer[] = this.playerService.createSessionPlayers({ ...room, players: sortedPlayers }, shuffledStarts);
        players.forEach((player) => {
            updateVisitedTiles(player);
        });
        if (game.mode === Mode.CTF) {
            this.gameSessionCtfService.assignCtfTeams(players);
        }
        const assignedStartKeys = new Set(shuffledStarts.slice(0, sortedPlayers.length).map((c) => `${c.row},${c.column}`));
        const sessionCells = game.cells.map((cell) => {
            if (cell.object === ObjectId.Start && !assignedStartKeys.has(`${cell.row},${cell.column}`)) {
                return { row: cell.row, column: cell.column, tile: cell.tile };
            }
            return cloneSessionCell(cell);
        });

        const session: GameSessionState = {
            sessionId: room.roomId,
            roomId: room.roomId,
            gameId: room.gameId,
            gridSize: Number(game.size) as GridSize,
            cells: sessionCells,
            players,
            activePlayerId: players[0]?.id ?? '',
            phase: players[0] ? 'transition' : 'turn',
            countdownMode: players[0] ? 'transition' : 'turn',
            countdownCombatPlayerIds: [],
            turnRemainingSeconds: players[0] ? DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN : 0,
            debugMode: false,
            messages: [],
            startTime: Date.now(),
        };
        this.sessions.set(room.roomId, session);
        this.sessionModes.set(room.roomId, game.mode);
        this.updateCallbacks.set(room.roomId, onSessionUpdate);
        if (onCombatEnd) {
            this.combatEndCallbacks.set(room.roomId, onCombatEnd);
        }
        this.startCountdown(room.roomId);
        return session;
    }

    getSession(roomId: string): GameSessionState | undefined {
        return this.sessions.get(roomId);
    }
    getSessionView(roomId: string, playerId: string): GameSessionState | undefined {
        const session = this.sessions.get(roomId);
        if (!session) {
            return undefined;
        }

        return {
            ...session,
            players: [...session.players],
            cells: [...session.cells],
            countdownCombatPlayerIds: [...session.countdownCombatPlayerIds],
            winnerPlayerIds: session.winnerPlayerIds ? [...session.winnerPlayerIds] : undefined,
            messages: filterMessagesForPlayerView(session, playerId),
        };
    }

    getPendingFlagTransfer(roomId: string): PendingFlagTransfer | undefined {
        return this.pendingFlagTransfers.get(roomId);
    }
    respondToFlagTransfer(roomId: string, responderId: string, accepted: boolean): GameSessionState | undefined {
        const session = this.sessions.get(roomId);
        if (!session) {
            return undefined;
        }

        this.gameSessionCtfService.respondToFlagTransfer(
            {
                roomId,
                responderId,
                accepted,
                mode: this.sessionModes.get(roomId),
                session,
                pendingTransfer: this.pendingFlagTransfers.get(roomId),
            },
            this.gameSessionHooksFactoryService.createCtfHooks(),
            (sessionState, activePlayer) => {
                this.gameSessionTurnService.completeTurnIfNoOptions(
                    sessionState,
                    activePlayer,
                    this.gameSessionHooksFactoryService.createTurnHooks(),
                );
            },
        );
        return session;
    }

    endTurn(roomId: string, playerId: string): GameSessionState | undefined {
        const session = this.sessions.get(roomId);
        if (!session) {
            return undefined;
        }

        const activePlayer = session.players.find((player) => player.id === session.activePlayerId);
        if (session.phase !== 'turn' || !activePlayer || activePlayer.id !== playerId || activePlayer.hasAbandoned) {
            return session;
        }

        this.gameSessionTurnService.completeTurn(session, activePlayer, this.gameSessionHooksFactoryService.createTurnHooks());
        this.emitSessionUpdate(roomId, session);
        return session;
    }

    performAction(roomId: string, playerId: string, payload: GridPosition & { sanctuaryMode?: SanctuaryActionMode }): GameSessionState | undefined {
        const session = this.sessions.get(roomId);
        if (!session) {
            return undefined;
        }

        return this.gameSessionPlayerActionService.performAction(
            roomId,
            playerId,
            payload,
            session,
            this.gameSessionHooksFactoryService.createPlayerActionHooks(),
        );
    }

    chooseCombatPosture(roomId: string, playerId: string, posture: CombatPosture): GameSessionState | undefined {
        const session = this.sessions.get(roomId);
        if (!session) {
            return session;
        }

        return this.gameSessionPlayerActionService.chooseCombatPosture(
            roomId,
            playerId,
            posture,
            session,
            this.gameSessionHooksFactoryService.createPlayerActionHooks(),
        );
    }

    movePlayer(roomId: string, playerId: string, payload: Pick<MovePlayerPayload, 'row' | 'column'>): GameSessionState | undefined {
        const session = this.sessions.get(roomId);
        if (!session) {
            return undefined;
        }

        return this.gameSessionPlayerActionService.movePlayer(
            roomId,
            playerId,
            payload,
            session,
            this.gameSessionHooksFactoryService.createPlayerActionHooks(),
        );
    }

    teleportPlayer(roomId: string, playerId: string, payload: Pick<TeleportPlayerPayload, 'row' | 'column'>): GameSessionState | undefined {
        const session = this.sessions.get(roomId);
        if (!session) {
            return undefined;
        }

        return this.gameSessionPlayerActionService.teleportPlayer(
            roomId,
            playerId,
            payload,
            session,
            this.gameSessionHooksFactoryService.createPlayerActionHooks(),
        );
    }

    toggleDebugMode(roomId: string): GameSessionState | undefined {
        const session = this.sessions.get(roomId);
        if (!session) {
            return undefined;
        }

        session.debugMode = !session.debugMode;
        appendSessionMessage(
            session,
            buildSystemMessage(session.debugMode ? 'Le mode debogage est actif.' : 'Le mode debogage est desactive.', 'debug'),
        );
        this.emitSessionUpdate(roomId, session);
        return session;
    }

    abandonPlayer(roomId: string, playerId: string): { session?: GameSessionState; cancellationMessage?: string } {
        const session = this.sessions.get(roomId);
        if (!session) {
            return {};
        }

        const abandonedPlayer = session.players.find((player) => player.id === playerId);
        if (!abandonedPlayer || abandonedPlayer.hasAbandoned) {
            return { session };
        }

        if (abandonedPlayer.playerType === PlayerType.VirtualPlayer) {
            return { session };
        }

        abandonedPlayer.hasAbandoned = true;
        this.pendingFlagTransfers.delete(roomId);
        this.gameSessionAbandonService.clearAbandonedPlayerSpawnMarker(session, this.playerSpawns.get(abandonedPlayer.id));
        dropFlagOnDefeatTile(session, abandonedPlayer);
        appendSessionMessage(session, buildSystemMessage(`${abandonedPlayer.name} a abandonne la partie.`, 'abandon', [abandonedPlayer]));
        this.gameSessionAbandonService.disableDebugModeAfterHostAbandon(
            session,
            abandonedPlayer,
            this.gameSessionHooksFactoryService.createAbandonHooks(),
        );
        const combatAbandonHandled = this.gameSessionAbandonService.handleCombatAbandon(
            session,
            abandonedPlayer,
            this.gameSessionHooksFactoryService.createAbandonHooks(),
        );

        const cancellationMessage = session.winnerPlayerId
            ? undefined
            : this.gameSessionAbandonService.getCancellationMessage(this.sessionModes.get(roomId), session);
        if (cancellationMessage) {
            this.removeSession(roomId);
            return { session, cancellationMessage };
        }

        if (combatAbandonHandled) {
            this.emitSessionUpdate(roomId, session);
            return { session };
        }

        if (session.activePlayerId === playerId) {
            this.gameSessionTurnService.startTransitionToNextTurn(session);
        }

        this.emitSessionUpdate(roomId, session);
        return { session };
    }

    removeSession(roomId: string): void {
        const interval = this.countdownIntervals.get(roomId);
        if (interval) {
            clearInterval(interval);
        }

        this.countdownIntervals.delete(roomId);
        this.countdownLastTickMs.delete(roomId);
        this.sessionModes.delete(roomId);
        this.updateCallbacks.delete(roomId);
        this.combatEndCallbacks.delete(roomId);
        this.sessions.delete(roomId);
    }

    private startCountdown(roomId: string): void {
        this.countdownLastTickMs.set(roomId, Date.now());
        const interval = setInterval(() => {
            const session = this.sessions.get(roomId);
            if (!session) {
                this.removeSession(roomId);
                return;
            }

            if (!this.gameSessionTurnService.hasActivePlayers(session)) {
                this.removeSession(roomId);
                return;
            }

            const now = Date.now();
            const lastTickMs = this.countdownLastTickMs.get(roomId) ?? now;
            const elapsedTicks = Math.max(TURN_ORDER_STEP, Math.floor((now - lastTickMs) / ONE_SECOND_MS));
            this.countdownLastTickMs.set(roomId, lastTickMs + elapsedTicks * ONE_SECOND_MS);

            for (let tick = 0; tick < elapsedTicks; tick++) {
                if (session.turnRemainingSeconds > TURN_ORDER_STEP) {
                    session.turnRemainingSeconds -= TURN_ORDER_STEP;
                } else {
                    this.gameSessionTurnService.advanceSessionPhase(session, this.gameSessionHooksFactoryService.createTurnHooks());
                }
            }

            this.emitSessionUpdate(roomId, session);
        }, ONE_SECOND_MS);

        this.countdownIntervals.set(roomId, interval);
    }

    private emitSessionUpdate(roomId: string, session: GameSessionState): void {
        this.updateCallbacks.get(roomId)?.(session);
    }

    private emitCombatEnd(payload: CombatEndPayload): void {
        this.combatEndCallbacks.get(payload.roomId)?.(payload);
    }

}
