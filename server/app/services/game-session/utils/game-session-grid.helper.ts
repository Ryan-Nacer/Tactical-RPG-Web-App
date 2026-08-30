import { Games } from '@app/model/database/game';
import { DoorState, ObjectId, TileId } from '@common/game';
import { GameSessionState } from '@common/game-session';

export type SessionCell = GameSessionState['cells'][number];

export function getManhattanDistance(first: { row: number; column: number }, second: { row: number; column: number }): number {
    return Math.abs(first.row - second.row) + Math.abs(first.column - second.column);
}

export function isShrineObject(object?: ObjectId): object is ObjectId.Heal | ObjectId.Combat {
    return object === ObjectId.Heal || object === ObjectId.Combat;
}

export function isBlockedTraversalCell(cell: Games['cells'][number]): boolean {
    return cell.tile === TileId.Wall || (cell.tile === TileId.Door && cell.doorState !== DoorState.Open) || isShrineObject(cell.object);
}

export function cloneSessionCell(cell: SessionCell, overrides: Partial<SessionCell> = {}): SessionCell {
    return {
        row: cell.row,
        column: cell.column,
        tile: cell.tile,
        object: cell.object,
        doorState: cell.doorState,
        shrineId: cell.shrineId,
        shrinePart: cell.shrinePart,
        shrineCooldownTurns: cell.shrineCooldownTurns,
        doorManipulated: cell.tile === TileId.Door ? (cell.doorManipulated ?? false) : undefined,
        shrineUsed: isShrineObject(cell.object) ? (cell.shrineUsed ?? false) : undefined,
        ...overrides,
    };
}
