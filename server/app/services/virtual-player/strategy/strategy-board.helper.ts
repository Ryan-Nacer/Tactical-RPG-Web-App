import { DoorState, GameCell, ObjectId, TileId } from '@common/game';
import { GameSessionPlayer, GameSessionState, GridPosition } from '@common/game-session';

export function getSessionCellAt(gameState: GameSessionState, position: GridPosition): GameCell | undefined {
    return gameState.cells.find((cell) => cell.row === position.row && cell.column === position.column);
}

export function isShrineObject(object?: ObjectId): boolean {
    return object === ObjectId.Heal || object === ObjectId.Combat;
}

/** Murs, portes fermées et cases de sanctuaire : impassables pour le pathfinding des JV. */
export function isCellBlockedOnVirtualPlayerPath(cell: GameCell): boolean {
    return cell.tile === TileId.Wall || (cell.tile === TileId.Door && cell.doorState !== DoorState.Open) || isShrineObject(cell.object);
}

export function isOccupiedByAnotherPlayer(gameState: GameSessionState, position: GridPosition, excludedPlayerId: string): boolean {
    return gameState.players.some(
        (player) =>
            !player.hasAbandoned &&
            player.id !== excludedPlayerId &&
            player.position.row === position.row &&
            player.position.column === position.column,
    );
}

export function collectShrineCells(gameState: GameSessionState, shrineTile: GameCell): GameCell[] {
    if (!shrineTile.shrineId) {
        return [shrineTile];
    }

    return gameState.cells.filter((cell) => cell.shrineId === shrineTile.shrineId);
}

export function isPlayerAdjacentToShrineGroup(player: GameSessionPlayer, shrineCells: GameCell[]): boolean {
    return shrineCells.some((cell) => Math.abs(player.position.row - cell.row) + Math.abs(player.position.column - cell.column) === 1);
}

export function isShrineGroupInactive(shrineCells: GameCell[]): boolean {
    return shrineCells.some((cell) => (cell.shrineCooldownTurns ?? 0) > 0);
}

export function canVirtualPlayerUseHealSanctuaryAt(
    gameState: GameSessionState,
    player: GameSessionPlayer,
    adjacentShrineTile: GridPosition,
): boolean {
    const clicked = getSessionCellAt(gameState, adjacentShrineTile);
    if (!clicked || clicked.object !== ObjectId.Heal) {
        return false;
    }

    const group = collectShrineCells(gameState, clicked);
    if (!isPlayerAdjacentToShrineGroup(player, group) || isShrineGroupInactive(group)) {
        return false;
    }

    return true;
}

export function canVirtualPlayerUseCombatSanctuaryAt(
    gameState: GameSessionState,
    player: GameSessionPlayer,
    adjacentShrineTile: GridPosition,
): boolean {
    const clicked = getSessionCellAt(gameState, adjacentShrineTile);
    if (!clicked || clicked.object !== ObjectId.Combat) {
        return false;
    }

    if (player.combatSanctuaryPointsLeft > 0) {
        return false;
    }

    const group = collectShrineCells(gameState, clicked);
    if (!isPlayerAdjacentToShrineGroup(player, group) || isShrineGroupInactive(group)) {
        return false;
    }

    return true;
}
