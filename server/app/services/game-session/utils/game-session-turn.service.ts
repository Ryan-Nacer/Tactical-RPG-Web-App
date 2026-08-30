import { Games } from '@app/model/database/game';
import { PlayerService } from '@app/services/player/player.service';
import { DoorState, TileId } from '@common/game';
import {
    DEFAULT_GAME_TURN_COUNTDOWN,
    DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN,
    GameSessionMessage,
    GameSessionPlayer,
    GameSessionState,
    GridPosition,
} from '@common/game-session';
import { GameSessionSanctuaryService } from '@app/services/game-session/sub-services/game-session-sanctuary.service';
import { buildSystemMessage } from './game-session-message.factory';

const TURN_ORDER_STEP = 1;
const ACTIONS_PER_TURN = 1;
const NO_ACTIVE_PLAYER_INDEX = -1;

export interface GameSessionTurnHooks {
    canCloseDoor: (session: GameSessionState, doorCell: Games['cells'][number], roomId: string) => boolean;
    resolveCombatRound: (session: GameSessionState) => void;
    endCombat: (session: GameSessionState) => void;
    expirePendingTransfer: (session: GameSessionState) => void;
    appendMessage: (session: GameSessionState, message: GameSessionMessage) => void;
}

export class GameSessionTurnService {
    constructor(
        private readonly playerService: PlayerService,
        private readonly sanctuaryService: GameSessionSanctuaryService,
    ) {}

    hasActivePlayers(session: GameSessionState): boolean {
        return session.players.some((player) => !player.hasAbandoned);
    }

    advanceSessionPhase(session: GameSessionState, hooks: GameSessionTurnHooks): void {
        if (this.isGameOver(session)) {
            return;
        }

        if (session.countdownMode === 'combat') {
            if (!session.combatState) {
                hooks.endCombat(session);
                return;
            }

            hooks.resolveCombatRound(session);
            return;
        }

        if (session.phase === 'transition') {
            this.startTurn(session, hooks);
            return;
        }

        this.startTransitionToNextTurn(session);
    }

    completeTurnIfNoOptions(session: GameSessionState, activePlayer: GameSessionPlayer, hooks: GameSessionTurnHooks): void {
        if (this.isGameOver(session)) {
            return;
        }

        if (this.playerService.hasAvailableCombatAction(session, activePlayer)) {
            return;
        }

        if (this.hasAvailableNonCombatAction(session, activePlayer, hooks)) {
            return;
        }

        if (this.playerService.hasAvailableMove(session, activePlayer)) {
            return;
        }

        this.completeTurn(session, activePlayer, hooks);
    }

    completeTurn(session: GameSessionState, activePlayer: GameSessionPlayer, hooks: GameSessionTurnHooks): void {
        if (this.isGameOver(session)) {
            return;
        }

        hooks.expirePendingTransfer(session);
        this.sanctuaryService.progressCombatSanctuaryEffect(activePlayer);
        hooks.appendMessage(session, buildSystemMessage(`${activePlayer.name} a termine son tour.`, 'turn-end', [activePlayer]));
        this.startTransitionToNextTurn(session);
        activePlayer.turnPlayed = (activePlayer.turnPlayed ?? 0) + TURN_ORDER_STEP;
    }

    getNextActivePlayerId(session: GameSessionState): string {
        if (session.players.length === 0) {
            return '';
        }

        const currentPlayerIndex = session.players.findIndex((player) => player.id === session.activePlayerId);
        for (let offset = TURN_ORDER_STEP; offset <= session.players.length; offset++) {
            const nextPlayerIndex =
                currentPlayerIndex > NO_ACTIVE_PLAYER_INDEX ? (currentPlayerIndex + offset) % session.players.length : offset - TURN_ORDER_STEP;
            const nextPlayer = session.players[nextPlayerIndex];

            if (!nextPlayer.hasAbandoned) {
                return nextPlayer.id;
            }
        }

        return '';
    }

    startTransitionToNextTurn(session: GameSessionState): void {
        if (this.isGameOver(session)) {
            return;
        }

        session.activePlayerId = this.getNextActivePlayerId(session);
        session.phase = session.activePlayerId ? 'transition' : 'turn';
        session.countdownMode = session.activePlayerId ? 'transition' : 'turn';
        session.countdownCombatPlayerIds = [];
        session.turnRemainingSeconds = session.activePlayerId ? DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN : 0;
    }

    startTurn(session: GameSessionState, hooks: GameSessionTurnHooks): void {
        if (this.isGameOver(session)) {
            return;
        }

        session.turnRemainingSeconds = session.activePlayerId ? DEFAULT_GAME_TURN_COUNTDOWN : 0;
        session.phase = 'turn';
        session.countdownMode = 'turn';
        session.countdownCombatPlayerIds = [];
        this.sanctuaryService.advanceShrineCooldowns(session);

        if (!session.activePlayerId) {
            return;
        }

        const activePlayer = session.players.find((player) => player.id === session.activePlayerId);
        if (!activePlayer) {
            return;
        }

        this.playerService.resetTurnResources(activePlayer, ACTIONS_PER_TURN);
        hooks.appendMessage(session, buildSystemMessage(`Le tour de ${activePlayer.name} commence.`, 'turn-start', [activePlayer]));
    }

    private hasAvailableNonCombatAction(session: GameSessionState, activePlayer: GameSessionPlayer, hooks: GameSessionTurnHooks): boolean {
        if (activePlayer.actionsLeft <= 0 || activePlayer.hasAbandoned) {
            return false;
        }

        const adjacentCells = this.getAdjacentCells(session, activePlayer.position);
        for (const adjacentCell of adjacentCells) {
            if (adjacentCell.tile === TileId.Door) {
                const currentDoorState = adjacentCell.doorState === DoorState.Open ? DoorState.Open : DoorState.Closed;
                if (currentDoorState === DoorState.Closed || hooks.canCloseDoor(session, adjacentCell, session.roomId)) {
                    return true;
                }
            }

            if (this.sanctuaryService.canUseSanctuaryOnCell(session, activePlayer, adjacentCell)) {
                return true;
            }
        }

        return false;
    }

    private getAdjacentCells(session: GameSessionState, position: GridPosition): Games['cells'] {
        const adjacentPositions = [
            { row: position.row - 1, column: position.column },
            { row: position.row + 1, column: position.column },
            { row: position.row, column: position.column - 1 },
            { row: position.row, column: position.column + 1 },
        ];

        return adjacentPositions
            .map((adjacentPosition) => session.cells.find((cell) => cell.row === adjacentPosition.row && cell.column === adjacentPosition.column))
            .filter((cell): cell is Games['cells'][number] => cell !== undefined);
    }

    private isGameOver(session: GameSessionState): boolean {
        return !!session.winnerPlayerId || !!session.winnerPlayerIds?.length;
    }
}
