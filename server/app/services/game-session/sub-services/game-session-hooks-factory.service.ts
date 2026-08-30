import {
    appendSessionMessage,
    canCloseDoor,
    dropFlagOnDefeatTile,
    teleportToSpawn,
} from '@app/services/game-session/utils/game-session-runtime.util';
import { GameSessionTurnHooks, GameSessionTurnService } from '@app/services/game-session/utils/game-session-turn.service';
import { Mode } from '@common/game';
import { CombatEndPayload, GameSessionState, GridPosition } from '@common/game-session';
import { GameSessionAbandonHooks } from './game-session-abandon.service';
import { GameSessionCombatHooks, GameSessionCombatService } from './game-session-combat.service';
import { GameSessionCtfHooks, GameSessionCtfService, PendingFlagTransfer } from './game-session-ctf.service';
import { GameSessionPlayerActionHooks } from './game-session-player-action.service';
import { GameSessionSanctuaryHooks } from './game-session-sanctuary.service';

interface GameSessionHooksFactoryDependencies {
    combatService: GameSessionCombatService;
    ctfService: GameSessionCtfService;
    turnService: GameSessionTurnService;
    getMode: (roomId: string) => Mode | undefined;
    getSpawnPosition: (playerId: string) => GridPosition | undefined;
    emitSessionUpdate: (roomId: string, session: GameSessionState) => void;
    removeSession: (roomId: string) => void;
    emitCombatEnd: (payload: CombatEndPayload) => void;
    hasPendingTransfer: (roomId: string) => boolean;
    getPendingTransfer: (roomId: string) => PendingFlagTransfer | undefined;
    setPendingTransfer: (roomId: string, transfer: PendingFlagTransfer) => void;
    clearPendingTransfer: (roomId: string) => void;
}

export class GameSessionHooksFactoryService {
    constructor(private readonly dependencies: GameSessionHooksFactoryDependencies) {}

    createCombatHooks(): GameSessionCombatHooks {
        return {
            appendMessage: appendSessionMessage,
            emitCombatEnd: (payload) => this.dependencies.emitCombatEnd(payload),
            dropFlagOnDefeatTile,
            teleportToSpawn: (session, player) => teleportToSpawn(session, player, this.dependencies.getSpawnPosition(player.id)),
            completeTurn: (session, player) => this.dependencies.turnService.completeTurn(session, player, this.createTurnHooks()),
            getMode: (roomId) => this.dependencies.getMode(roomId),
        };
    }

    createSanctuaryHooks(): GameSessionSanctuaryHooks {
        return {
            appendMessage: appendSessionMessage,
        };
    }

    createPlayerActionHooks(): GameSessionPlayerActionHooks {
        return {
            getMode: (roomId) => this.dependencies.getMode(roomId),
            getCombatHooks: () => this.createCombatHooks(),
            getCtfHooks: () => this.createCtfHooks(),
            getTurnHooks: () => this.createTurnHooks(),
            getSanctuaryHooks: () => this.createSanctuaryHooks(),
            emitSessionUpdate: (roomId, session) => this.dependencies.emitSessionUpdate(roomId, session),
        };
    }

    createCtfHooks(): GameSessionCtfHooks {
        return {
            appendMessage: appendSessionMessage,
            emitSessionUpdate: (roomId, session) => this.dependencies.emitSessionUpdate(roomId, session),
            removeSession: (roomId) => this.dependencies.removeSession(roomId),
            hasPendingTransfer: (roomId) => this.dependencies.hasPendingTransfer(roomId),
            setPendingTransfer: (roomId, transfer) => this.dependencies.setPendingTransfer(roomId, transfer),
            clearPendingTransfer: (roomId) => this.dependencies.clearPendingTransfer(roomId),
            getSpawnPosition: (playerId) => this.dependencies.getSpawnPosition(playerId),
        };
    }

    createTurnHooks(): GameSessionTurnHooks {
        return {
            canCloseDoor: (session, doorCell, roomId) => canCloseDoor(session, doorCell, this.dependencies.getMode(roomId)),
            resolveCombatRound: (session) => this.dependencies.combatService.resolveCombatRound(session, this.createCombatHooks()),
            endCombat: (session) => this.dependencies.combatService.endCombat(session),
            expirePendingTransfer: (session) => {
                const pendingTransfer = this.dependencies.getPendingTransfer(session.roomId);
                this.dependencies.ctfService.expirePendingTransfer(session.roomId, session, pendingTransfer, this.createCtfHooks());
            },
            appendMessage: appendSessionMessage,
        };
    }

    createAbandonHooks(): GameSessionAbandonHooks {
        return {
            dropFlagOnDefeatTile,
            teleportToSpawn: (session, player) => teleportToSpawn(session, player, this.dependencies.getSpawnPosition(player.id)),
            endCombat: (session) => this.dependencies.combatService.endCombat(session),
            startTransitionToNextTurn: (session) => this.dependencies.turnService.startTransitionToNextTurn(session),
            appendMessage: appendSessionMessage,
            emitCombatEnd: (payload) => this.dependencies.emitCombatEnd(payload),
        };
    }
}
