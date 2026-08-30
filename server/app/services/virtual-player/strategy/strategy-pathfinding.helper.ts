import { CARDINAL_NEIGHBOR_OFFSETS, DoorState, GameCell, TileId, getTerrainMovementCost } from '@common/game';
import { GameSessionPlayer, GameSessionState, GridPosition } from '@common/game-session';
import { getSessionCellAt, isCellBlockedOnVirtualPlayerPath, isOccupiedByAnotherPlayer } from './strategy-board.helper';

type StepOption = {
    position: GridPosition;
    cost: number;
    pathCost: number;
};

export type PathfindingOptions = {
    openedClosedDoorKey?: string;
};

const TRACE_VP = process.env.VP_TRACE === '1';

export function toGridKey(position: GridPosition): string {
    return `${position.row},${position.column}`;
}

export function fromGridKey(key: string): GridPosition {
    const [row, column] = key.split(',').map(Number);
    return { row, column };
}

export function computeShortestPathCostToGoalKeys(
    gameState: GameSessionState,
    controlledPlayer: GameSessionPlayer,
    start: GridPosition,
    goalKeys: Set<string>,
    options: PathfindingOptions = {},
): number | undefined {
    const unvisited = new Set<string>();
    const distances = new Map<string, number>();

    for (const cell of gameState.cells) {
        if (isTraversableForPathfinding(gameState, controlledPlayer, cell, start, options)) {
            const key = toGridKey({ row: cell.row, column: cell.column });
            unvisited.add(key);
            distances.set(key, Number.POSITIVE_INFINITY);
        }
    }

    const startKey = toGridKey(start);
    if (!unvisited.has(startKey)) {
        return undefined;
    }

    distances.set(startKey, 0);

    while (unvisited.size > 0) {
        const currentKey = getClosestUnvisitedKey(unvisited, distances);
        if (!currentKey) {
            return undefined;
        }

        const currentDistance = distances.get(currentKey);
        if (currentDistance === undefined || currentDistance === Number.POSITIVE_INFINITY) {
            return undefined;
        }

        if (goalKeys.has(currentKey)) {
            return currentDistance;
        }

        unvisited.delete(currentKey);
        const currentPosition = fromGridKey(currentKey);

        for (const offset of CARDINAL_NEIGHBOR_OFFSETS) {
            const neighbor = { row: currentPosition.row + offset.row, column: currentPosition.column + offset.column };
            const neighborKey = toGridKey(neighbor);
            if (!unvisited.has(neighborKey)) {
                continue;
            }

            const neighborCell = getSessionCellAt(gameState, neighbor);
            if (!neighborCell) {
                continue;
            }

            const alternateDistance = currentDistance + getPathfindingStepCost(neighborCell.tile);
            if (alternateDistance < (distances.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
                distances.set(neighborKey, alternateDistance);
            }
        }
    }

    return undefined;
}

type StepPreference = {
    totalCost: number;
    remainingDistance: number;
    stepCost: number;
    manhattanToAnchor: number;
    row: number;
    column: number;
};

function pickAnchorGoalForTieBreak(from: GridPosition, goals: GridPosition[]): GridPosition {
    let anchor = goals[0];
    let bestManhattan = Number.POSITIVE_INFINITY;
    for (const goal of goals) {
        const manhattan = Math.abs(goal.row - from.row) + Math.abs(goal.column - from.column);
        if (
            manhattan < bestManhattan ||
            (manhattan === bestManhattan && (goal.row < anchor.row || (goal.row === anchor.row && goal.column < anchor.column)))
        ) {
            bestManhattan = manhattan;
            anchor = goal;
        }
    }
    return anchor;
}

/** Negative if `first` is a strictly better movement choice than `second`. */
function compareStepPreference(first: StepPreference, second: StepPreference): number {
    const keys: (keyof StepPreference)[] = ['totalCost', 'remainingDistance', 'stepCost', 'manhattanToAnchor', 'row', 'column'];
    for (const key of keys) {
        if (first[key] !== second[key]) {
            return first[key] - second[key];
        }
    }
    return 0;
}

export function computeBestAdjacentStepTowardsGoals(
    gameState: GameSessionState,
    controlledPlayer: GameSessionPlayer,
    goals: GridPosition[],
): GridPosition | undefined {
    if (goals.length === 0) {
        return undefined;
    }

    const goalKeys = new Set(goals.map((goal) => toGridKey(goal)));
    const adjacentSteps = getAdjacentStepOptions(gameState, controlledPlayer);
    if (adjacentSteps.length === 0 && TRACE_VP) {
        // eslint-disable-next-line no-console
        console.log(
            `[VP] adjacent-blocked id=${controlledPlayer.id} pos=${controlledPlayer.position.row},${controlledPlayer.position.column} ` +
                describeAdjacentBlockages(gameState, controlledPlayer),
        );
    }
    const anchorGoal = pickAnchorGoalForTieBreak(controlledPlayer.position, goals);

    let bestStep: StepOption | undefined;
    let bestPreference: StepPreference | undefined;

    for (const step of adjacentSteps) {
        const stepKey = toGridKey(step.position);
        const remainingDistance = goalKeys.has(stepKey) ? 0 : computeShortestPathCostToGoalKeys(gameState, controlledPlayer, step.position, goalKeys);

        if (remainingDistance === undefined) {
            continue;
        }

        // Full step cost = PM to enter tile + remaining shortest path to any goal in the set.
        const totalCost = step.pathCost + remainingDistance;
        const manhattanToAnchor = Math.abs(step.position.row - anchorGoal.row) + Math.abs(step.position.column - anchorGoal.column);

        const preference: StepPreference = {
            totalCost,
            remainingDistance,
            stepCost: step.pathCost,
            manhattanToAnchor,
            row: step.position.row,
            column: step.position.column,
        };

        if (bestPreference === undefined || compareStepPreference(preference, bestPreference) < 0) {
            bestPreference = preference;
            bestStep = step;
        }
    }

    return bestStep?.position;
}

type AwayPreference = {
    distanceFromThreat: number;
    stepCost: number;
    row: number;
    column: number;
};

function compareAwayPreference(first: AwayPreference, second: AwayPreference): number {
    if (first.distanceFromThreat !== second.distanceFromThreat) {
        return second.distanceFromThreat - first.distanceFromThreat;
    }
    if (first.stepCost !== second.stepCost) {
        return first.stepCost - second.stepCost;
    }
    if (first.row !== second.row) {
        return first.row - second.row;
    }
    return first.column - second.column;
}

export function computeBestAdjacentStepAwayFromThreat(
    gameState: GameSessionState,
    controlledPlayer: GameSessionPlayer,
    threatPosition: GridPosition,
): GridPosition | undefined {
    const adjacentSteps = getAdjacentStepOptions(gameState, controlledPlayer);
    if (adjacentSteps.length === 0 && TRACE_VP) {
        // eslint-disable-next-line no-console
        console.log(
            `[VP] adjacent-blocked id=${controlledPlayer.id} pos=${controlledPlayer.position.row},${controlledPlayer.position.column} ` +
                describeAdjacentBlockages(gameState, controlledPlayer),
        );
    }

    let bestStep: StepOption | undefined;
    let bestPreference: AwayPreference | undefined;

    for (const step of adjacentSteps) {
        const distanceFromThreat = Math.abs(step.position.row - threatPosition.row) + Math.abs(step.position.column - threatPosition.column);

        const preference: AwayPreference = {
            distanceFromThreat,
            stepCost: step.pathCost,
            row: step.position.row,
            column: step.position.column,
        };

        if (!bestPreference || compareAwayPreference(preference, bestPreference) < 0) {
            bestPreference = preference;
            bestStep = step;
        }
    }

    return bestStep?.position;
}

function getAdjacentStepOptions(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StepOption[] {
    return CARDINAL_NEIGHBOR_OFFSETS.map((offset) => ({
        row: controlledPlayer.position.row + offset.row,
        column: controlledPlayer.position.column + offset.column,
    }))
        .map((position) => {
            const cell = getSessionCellAt(gameState, position);
            if (!cell || isCellBlockedOnVirtualPlayerPath(cell) || isOccupiedByAnotherPlayer(gameState, position, controlledPlayer.id)) {
                return undefined;
            }

            const cost = getTerrainMovementCost(cell.tile);
            if (cost > controlledPlayer.movementPointsLeft) {
                return undefined;
            }

            return { position, cost, pathCost: getPathfindingStepCost(cell.tile) };
        })
        .filter((step): step is StepOption => step !== undefined);
}

function describeAdjacentBlockages(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): string {
    const parts: string[] = [];

    for (const offset of CARDINAL_NEIGHBOR_OFFSETS) {
        const position = { row: controlledPlayer.position.row + offset.row, column: controlledPlayer.position.column + offset.column };
        const cell = getSessionCellAt(gameState, position);
        if (!cell) {
            parts.push(`${position.row},${position.column}=out`);
            continue;
        }

        if (isCellBlockedOnVirtualPlayerPath(cell)) {
            parts.push(`${position.row},${position.column}=blocked`);
            continue;
        }

        if (isOccupiedByAnotherPlayer(gameState, position, controlledPlayer.id)) {
            parts.push(`${position.row},${position.column}=occupied`);
            continue;
        }

        const cost = getTerrainMovementCost(cell.tile);
        if (cost > controlledPlayer.movementPointsLeft) {
            parts.push(`${position.row},${position.column}=mp`);
            continue;
        }

        parts.push(`${position.row},${position.column}=ok`);
    }

    return parts.join(' ');
}

function isTraversableForPathfinding(
    gameState: GameSessionState,
    controlledPlayer: GameSessionPlayer,
    cell: GameCell,
    start: GridPosition,
    options: PathfindingOptions,
): boolean {
    const position = { row: cell.row, column: cell.column };
    const isStart = position.row === start.row && position.column === start.column;

    const isVirtuallyOpenedDoor =
        options.openedClosedDoorKey !== undefined &&
        cell.tile === TileId.Door &&
        cell.doorState !== DoorState.Open &&
        toGridKey(position) === options.openedClosedDoorKey;
    if (!isVirtuallyOpenedDoor && isCellBlockedOnVirtualPlayerPath(cell)) {
        return false;
    }

    if (isStart) {
        return true;
    }

    return !isOccupiedByAnotherPlayer(gameState, position, controlledPlayer.id);
}

function getClosestUnvisitedKey(unvisited: Set<string>, distances: Map<string, number>): string | undefined {
    let closestKey: string | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const key of unvisited) {
        const distance = distances.get(key) ?? Number.POSITIVE_INFINITY;
        if (distance < closestDistance) {
            closestDistance = distance;
            closestKey = key;
        }
    }

    return closestKey;
}

function getPathfindingStepCost(tile: TileId): number {
    const terrainCost = getTerrainMovementCost(tile);
    return terrainCost === 0 ? 1 : terrainCost;
}
