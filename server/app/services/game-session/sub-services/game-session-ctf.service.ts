import { getManhattanDistance } from '@app/services/game-session/utils/game-session-grid.helper';
import { buildPlayerMessage, buildSystemMessage } from '@app/services/game-session/utils/game-session-message.factory';
import { Mode, ObjectId } from '@common/game';
import { GameSessionMessage, GameSessionPlayer, GameSessionState, GridPosition } from '@common/game-session';
import { PlayerType } from '@common/player';

const TURN_ORDER_STEP = 1;

export interface PendingFlagTransfer {
    initiatorId: string;
    teammateId: string;
    target: GridPosition;
}

export interface GameSessionCtfHooks {
    appendMessage: (session: GameSessionState, message: GameSessionMessage) => void;
    emitSessionUpdate: (roomId: string, session: GameSessionState) => void;
    removeSession: (roomId: string) => void;
    hasPendingTransfer: (roomId: string) => boolean;
    setPendingTransfer: (roomId: string, transfer: PendingFlagTransfer) => void;
    clearPendingTransfer: (roomId: string) => void;
    getSpawnPosition: (playerId: string) => GridPosition | undefined;
}

interface CtfFlagTransferInput {
    roomId: string;
    mode: Mode | undefined;
    session: GameSessionState;
    activePlayer: GameSessionPlayer;
    target: GridPosition;
}

interface CtfRespondToTransferInput {
    roomId: string;
    responderId: string;
    accepted: boolean;
    mode: Mode | undefined;
    session: GameSessionState;
    pendingTransfer: PendingFlagTransfer | undefined;
}

export class GameSessionCtfService {
    assignCtfTeams(players: GameSessionPlayer[]): void {
        const half = players.length / 2;
        players.forEach((player, index) => {
            player.team = index < half ? 'A' : 'B';
        });
    }

    tryExchangeFlagWithTeammate(input: CtfFlagTransferInput, hooks: GameSessionCtfHooks): boolean {
        const { roomId, mode, session, activePlayer, target } = input;
        if (mode !== Mode.CTF || !activePlayer.team) {
            return false;
        }

        if (activePlayer.playerType === PlayerType.VirtualPlayer) {
            return false;
        }

        const teammate = this.findAdjacentActiveTeammateAtTarget(session, activePlayer, target);
        if (!teammate || !this.canExchangeFlagBetween(activePlayer, teammate)) {
            return false;
        }

        if (hooks.hasPendingTransfer(roomId)) {
            return false;
        }

        hooks.setPendingTransfer(roomId, {
            initiatorId: activePlayer.id,
            teammateId: teammate.id,
            target,
        });

        hooks.appendMessage(
            session,
            buildSystemMessage(`${activePlayer.name} propose un transfert du drapeau a ${teammate.name}.`, 'flag', [activePlayer, teammate]),
        );
        return true;
    }

    respondToFlagTransfer(
        input: CtfRespondToTransferInput,
        hooks: GameSessionCtfHooks,
        completeTurnIfNoOptions: (session: GameSessionState, activePlayer: GameSessionPlayer) => void,
    ): boolean {
        const { roomId, responderId, accepted, mode, session, pendingTransfer } = input;
        if (!pendingTransfer || pendingTransfer.teammateId !== responderId) {
            return false;
        }

        hooks.clearPendingTransfer(roomId);
        const transferPlayers = this.getPendingTransferPlayers(session, pendingTransfer);
        if (!transferPlayers) {
            hooks.appendMessage(session, buildSystemMessage('Le transfert de drapeau est annule.', 'flag'));
            hooks.emitSessionUpdate(roomId, session);
            return true;
        }

        const { initiator, teammate } = transferPlayers;
        if (!accepted) {
            hooks.appendMessage(session, buildSystemMessage(`${teammate.name} refuse le transfert du drapeau.`, 'flag', [initiator, teammate]));
            hooks.emitSessionUpdate(roomId, session);
            return true;
        }

        if (!this.isPendingTransferStillValid(mode, initiator, teammate, pendingTransfer)) {
            hooks.appendMessage(session, buildSystemMessage('Le transfert de drapeau est devenu invalide.', 'flag', [initiator, teammate]));
            hooks.emitSessionUpdate(roomId, session);
            return true;
        }

        const giver = initiator.hasFlag ? initiator : teammate;
        const receiver = giver.id === initiator.id ? teammate : initiator;
        giver.hasFlag = false;
        receiver.hasFlag = true;
        receiver.hasHeldFlag = true;

        hooks.appendMessage(session, buildPlayerMessage(`${giver.name} passe le drapeau a ${receiver.name}.`, initiator, 'flag', [giver, receiver]));

        if (this.checkCtfWinCondition(roomId, mode, session, receiver, hooks)) {
            return true;
        }

        completeTurnIfNoOptions(session, initiator);
        hooks.emitSessionUpdate(roomId, session);
        return true;
    }

    expirePendingTransfer(
        roomId: string,
        session: GameSessionState,
        pendingTransfer: PendingFlagTransfer | undefined,
        hooks: GameSessionCtfHooks,
    ): boolean {
        if (!pendingTransfer) {
            return false;
        }

        hooks.clearPendingTransfer(roomId);
        const transferPlayers = this.getPendingTransferPlayers(session, pendingTransfer);
        if (!transferPlayers) {
            hooks.appendMessage(session, buildSystemMessage('Le transfert de drapeau est annule.', 'flag'));
            return true;
        }

        const { initiator, teammate } = transferPlayers;
        hooks.appendMessage(
            session,
            buildSystemMessage(`${teammate.name} refuse automatiquement le transfert du drapeau faute de reponse.`, 'flag', [initiator, teammate]),
        );
        return true;
    }

    canExchangeFlagBetween(firstPlayer: GameSessionPlayer, secondPlayer: GameSessionPlayer): boolean {
        return Boolean(firstPlayer.hasFlag) !== Boolean(secondPlayer.hasFlag);
    }

    checkCtfWinCondition(
        roomId: string,
        mode: Mode | undefined,
        session: GameSessionState,
        player: GameSessionPlayer,
        hooks: GameSessionCtfHooks,
    ): boolean {
        if (mode !== Mode.CTF || !player.hasFlag) {
            return false;
        }

        const spawn = hooks.getSpawnPosition(player.id);
        if (!spawn || player.position.row !== spawn.row || player.position.column !== spawn.column) {
            return false;
        }

        const winningTeam = player.team;
        const winners = winningTeam ? session.players.filter((p) => !p.hasAbandoned && p.team === winningTeam) : [player];

        session.winnerPlayerId = player.id;
        session.winnerPlayerIds = winners.map((p) => p.id);
        session.endTime = Date.now();
        session.countdownMode = 'disabled';
        session.turnRemainingSeconds = 0;
        hooks.clearPendingTransfer(roomId);
        hooks.appendMessage(
            session,
            buildSystemMessage(
                `${player.name} a ramene le drapeau a son point de depart ! L'equipe ${winningTeam ?? player.name} remporte la partie !`,
                'game-end',
                winners,
            ),
        );
        hooks.emitSessionUpdate(roomId, session);
        hooks.removeSession(roomId);
        return true;
    }

    canTriggerCombatBetween(mode: Mode | undefined, attacker: GameSessionPlayer, defender: GameSessionPlayer): boolean {
        if (mode !== Mode.CTF) {
            return true;
        }

        if (!attacker.team || !defender.team) {
            return true;
        }

        return attacker.team !== defender.team;
    }

    tryPickUpFlag(mode: Mode | undefined, session: GameSessionState, player: GameSessionPlayer, hooks: GameSessionCtfHooks): void {
        if (mode !== Mode.CTF || player.hasFlag) {
            return;
        }

        const flagCell = session.cells.find(
            (cell) => cell.row === player.position.row && cell.column === player.position.column && cell.object === ObjectId.Flag,
        );
        if (!flagCell) {
            return;
        }

        player.hasFlag = true;
        player.hasHeldFlag = true;
        flagCell.object = undefined;
        hooks.appendMessage(session, buildSystemMessage(`${player.name} a ramasse le drapeau.`, 'flag', [player]));
    }

    private findAdjacentActiveTeammateAtTarget(
        session: GameSessionState,
        activePlayer: GameSessionPlayer,
        target: GridPosition,
    ): GameSessionPlayer | undefined {
        if (getManhattanDistance(activePlayer.position, target) !== TURN_ORDER_STEP) {
            return undefined;
        }

        return session.players.find(
            (player) =>
                !player.hasAbandoned &&
                player.id !== activePlayer.id &&
                player.team === activePlayer.team &&
                player.position.row === target.row &&
                player.position.column === target.column,
        );
    }

    private getPendingTransferPlayers(
        session: GameSessionState,
        pendingTransfer: PendingFlagTransfer,
    ): { initiator: GameSessionPlayer; teammate: GameSessionPlayer } | undefined {
        const initiator = session.players.find((player) => player.id === pendingTransfer.initiatorId && !player.hasAbandoned);
        const teammate = session.players.find((player) => player.id === pendingTransfer.teammateId && !player.hasAbandoned);

        if (!initiator || !teammate) {
            return undefined;
        }

        return { initiator, teammate };
    }

    private isPendingTransferStillValid(
        mode: Mode | undefined,
        initiator: GameSessionPlayer,
        teammate: GameSessionPlayer,
        pendingTransfer: PendingFlagTransfer,
    ): boolean {
        return (
            mode === Mode.CTF &&
            initiator.team === teammate.team &&
            getManhattanDistance(initiator.position, teammate.position) === TURN_ORDER_STEP &&
            teammate.position.row === pendingTransfer.target.row &&
            teammate.position.column === pendingTransfer.target.column &&
            this.canExchangeFlagBetween(initiator, teammate)
        );
    }
}
