import { GameSessionState } from '@common/game-session';
import { VirtualPlayerSnapshot } from './virtual-player.types';

export function captureVirtualPlayerSnapshot(gameState: GameSessionState, playerId: string): VirtualPlayerSnapshot | undefined {
    const player = gameState.players.find((candidate) => candidate.id === playerId && !candidate.hasAbandoned);
    if (!player) {
        return undefined;
    }

    return {
        phase: gameState.phase,
        activePlayerId: gameState.activePlayerId,
        row: player.position.row,
        column: player.position.column,
        movementPointsLeft: player.movementPointsLeft,
        actionsLeft: player.actionsLeft,
        hasFlag: player.hasFlag ?? false,
        messagesCount: gameState.messages.length,
    };
}

export function areVirtualPlayerSnapshotsEqual(first: VirtualPlayerSnapshot, second: VirtualPlayerSnapshot): boolean {
    return (
        first.phase === second.phase &&
        first.activePlayerId === second.activePlayerId &&
        first.row === second.row &&
        first.column === second.column &&
        first.movementPointsLeft === second.movementPointsLeft &&
        first.actionsLeft === second.actionsLeft &&
        first.hasFlag === second.hasFlag &&
        first.messagesCount === second.messagesCount
    );
}
