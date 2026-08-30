import { Games } from '@app/model/database/game';
import { DoorState, Mode, ObjectId, TileId, isTerrainTile } from '@common/game';
import { GameSessionMessage, GameSessionPlayer, GameSessionState, GridPosition } from '@common/game-session';
import { getManhattanDistance, isBlockedTraversalCell } from './game-session-grid.helper';
import { buildPlayerMessage, buildSystemMessage } from './game-session-message.factory';

const TURN_ORDER_STEP = 1;

export function appendSessionMessage(session: GameSessionState, message: GameSessionMessage): void {
    session.messages = [...session.messages, message];
}

export function updateVisitedTiles(player: GameSessionPlayer): void {
    if (!player.visitedTiles) {
        player.visitedTiles = [];
    }

    const visitedTile = `${player.position.row},${player.position.column}`;
    if (!player.visitedTiles.includes(visitedTile)) {
        player.visitedTiles.push(visitedTile);
    }
}

export function canCloseDoor(session: GameSessionState, doorCell: Games['cells'][number], mode: Mode | undefined): boolean {
    const occupiedByPlayer = session.players.some(
        (player) => !player.hasAbandoned && player.position.row === doorCell.row && player.position.column === doorCell.column,
    );
    if (occupiedByPlayer) {
        return false;
    }

    return !(mode === Mode.CTF && doorCell.object === ObjectId.Flag);
}

export function tryToggleDoor(session: GameSessionState, activePlayer: GameSessionPlayer, target: GridPosition, mode: Mode | undefined): boolean {
    if (getManhattanDistance(activePlayer.position, target) !== TURN_ORDER_STEP) {
        return false;
    }

    const doorCell = session.cells.find((cell) => cell.row === target.row && cell.column === target.column);
    if (!doorCell || doorCell.tile !== TileId.Door) {
        return false;
    }

    const currentDoorState = doorCell.doorState === DoorState.Open ? DoorState.Open : DoorState.Closed;
    if (currentDoorState === DoorState.Open && !canCloseDoor(session, doorCell, mode)) {
        return false;
    }

    const nextDoorState = currentDoorState === DoorState.Open ? DoorState.Closed : DoorState.Open;
    doorCell.doorState = nextDoorState;
    doorCell.doorManipulated = true;

    const actionLabel = nextDoorState === DoorState.Open ? 'ouvre' : 'ferme';
    appendSessionMessage(session, buildPlayerMessage(`${activePlayer.name} ${actionLabel} une porte.`, activePlayer, 'door'));
    return true;
}

export function teleportToSpawn(session: GameSessionState, player: GameSessionPlayer, spawn: { row: number; column: number } | undefined): void {
    if (!spawn) {
        return;
    }

    const nearestFreePosition = session.cells
        .filter((cell) => !isBlockedTraversalCell(cell))
        .filter(
            (cell) =>
                !session.players.some(
                    (otherPlayer) =>
                        !otherPlayer.hasAbandoned &&
                        otherPlayer.id !== player.id &&
                        otherPlayer.position.row === cell.row &&
                        otherPlayer.position.column === cell.column,
                ),
        )
        .map((cell) => ({ row: cell.row, column: cell.column }))
        .reduce<{ row: number; column: number } | null>((bestPosition, currentPosition) => {
            if (!bestPosition) {
                return currentPosition;
            }

            const currentDistance = getManhattanDistance(spawn, currentPosition);
            const bestDistance = getManhattanDistance(spawn, bestPosition);
            return currentDistance < bestDistance ? currentPosition : bestPosition;
        }, null);

    player.position = nearestFreePosition ?? spawn;
}

function findNearestFreeTerrainTile(
    session: GameSessionState,
    origin: GridPosition,
    excludedPlayerId?: string,
): GameSessionState['cells'][number] | undefined {
    return session.cells
        .filter((cell) => isValidFlagDropTile(session, cell, excludedPlayerId))
        .reduce<GameSessionState['cells'][number] | undefined>((bestCell, currentCell) => {
            if (!bestCell) {
                return currentCell;
            }

            const currentDistance = getManhattanDistance(origin, currentCell);
            const bestDistance = getManhattanDistance(origin, bestCell);
            return currentDistance < bestDistance ? currentCell : bestCell;
        }, undefined);
}

function isValidFlagDropTile(session: GameSessionState, cell: GameSessionState['cells'][number], excludedPlayerId?: string): boolean {
    return (
        isTerrainTile(cell.tile) &&
        cell.object === undefined &&
        !session.players.some(
            (player) =>
                !player.hasAbandoned &&
                player.id !== excludedPlayerId &&
                player.position.row === cell.row &&
                player.position.column === cell.column,
        )
    );
}

export function dropFlagOnDefeatTile(session: GameSessionState, defeatedPlayer: GameSessionPlayer): void {
    if (!defeatedPlayer.hasFlag) {
        return;
    }

    const defeatCell = session.cells.find((cell) => cell.row === defeatedPlayer.position.row && cell.column === defeatedPlayer.position.column);
    const dropCell =
        defeatCell && isValidFlagDropTile(session, defeatCell, defeatedPlayer.id)
            ? defeatCell
            : findNearestFreeTerrainTile(session, defeatedPlayer.position, defeatedPlayer.id);
    if (!dropCell) {
        return;
    }

    defeatedPlayer.hasFlag = false;
    dropCell.object = ObjectId.Flag;
    appendSessionMessage(session, buildSystemMessage(`${defeatedPlayer.name} a laisse tomber le drapeau.`, 'flag', [defeatedPlayer]));
}
