import { CARDINAL_NEIGHBOR_OFFSETS, DoorState, GridSize, ObjectId, TileId } from '@common/game';
import { GameSessionPlayer, GameSessionState, GridPosition, SanctuaryActionMode } from '@common/game-session';
import {
    canVirtualPlayerUseCombatSanctuaryAt,
    canVirtualPlayerUseHealSanctuaryAt,
    getSessionCellAt,
    isCellBlockedOnVirtualPlayerPath,
    isOccupiedByAnotherPlayer,
} from './strategy-board.helper';
import {
    computeBestAdjacentStepAwayFromThreat,
    computeBestAdjacentStepTowardsGoals,
    computeShortestPathCostToGoalKeys,
    toGridKey,
} from './strategy-pathfinding.helper';
import { StrategyDecision } from './strategy.types';

export abstract class StrategyCoreBase {
    constructor(private readonly vpId: string) {}

    getId(): string {
        return this.vpId;
    }

    process(gameState: GameSessionState): StrategyDecision {
        const controlledPlayer = this.getControlledPlayer(gameState);
        if (!controlledPlayer || controlledPlayer.hasAbandoned) {
            return { type: 'none' };
        }

        return this.strategize(gameState, controlledPlayer);
    }

    protected abstract strategize(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision;

    protected getControlledPlayer(gameState: GameSessionState): GameSessionPlayer | undefined {
        return gameState.players.find((player) => player.id === this.vpId && !player.hasAbandoned);
    }

    protected getEnemies(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GameSessionPlayer[] {
        return gameState.players.filter((player) => {
            if (player.id === controlledPlayer.id || player.hasAbandoned) {
                return false;
            }

            if (!controlledPlayer.team || !player.team) {
                return true;
            }

            return player.team !== controlledPlayer.team;
        });
    }

    protected getEnemyFlagBearer(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GameSessionPlayer | undefined {
        return this.getEnemies(gameState, controlledPlayer).find((enemy) => enemy.hasFlag);
    }

    protected getAlliedFlagBearer(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GameSessionPlayer | undefined {
        return gameState.players.find(
            (player) =>
                !player.hasAbandoned &&
                player.id !== controlledPlayer.id &&
                player.hasFlag &&
                controlledPlayer.team !== undefined &&
                player.team === controlledPlayer.team,
        );
    }

    protected getAdjacentEnemy(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GameSessionPlayer | undefined {
        const adjacentEnemies = this.getEnemies(gameState, controlledPlayer).filter(
            (enemy) => this.getManhattanDistance(controlledPlayer.position, enemy.position) === 1,
        );
        if (adjacentEnemies.length === 0) {
            return undefined;
        }

        return adjacentEnemies.reduce((best, candidate) => (candidate.health < best.health ? candidate : best));
    }

    protected chooseNextStepTowardsGoals(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        goals: GridPosition[],
    ): GridPosition | undefined {
        if (goals.length === 0 || this.isAlreadyOnAnyGoal(controlledPlayer, goals)) {
            return undefined;
        }

        const primaryGoal = this.resolvePrimaryMovementGoal(gameState, controlledPlayer, goals);
        if (!primaryGoal) {
            return undefined;
        }

        return computeBestAdjacentStepTowardsGoals(gameState, controlledPlayer, [primaryGoal]);
    }

    protected getClosestEnemyByPath(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GameSessionPlayer | undefined {
        let closestEnemy: GameSessionPlayer | undefined;
        let closestDistance = Number.POSITIVE_INFINITY;

        for (const enemy of this.getEnemies(gameState, controlledPlayer)) {
            const engagementGoals = this.getEngagementGoals(gameState, controlledPlayer, enemy);
            if (engagementGoals.length === 0) {
                continue;
            }

            const distance = computeShortestPathCostToGoalKeys(
                gameState,
                controlledPlayer,
                controlledPlayer.position,
                new Set(engagementGoals.map((goal) => toGridKey(goal))),
            );
            if (distance === undefined || distance >= closestDistance) {
                continue;
            }

            closestDistance = distance;
            closestEnemy = enemy;
        }

        return closestEnemy;
    }

    protected getClosestEnemyByManhattan(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GameSessionPlayer | undefined {
        const enemies = this.getEnemies(gameState, controlledPlayer);
        if (enemies.length === 0) {
            return undefined;
        }

        let closestEnemy = enemies[0];
        let closestDistance = this.getManhattanDistance(controlledPlayer.position, closestEnemy.position);

        for (const enemy of enemies.slice(1)) {
            const distance = this.getManhattanDistance(controlledPlayer.position, enemy.position);
            if (distance < closestDistance) {
                closestEnemy = enemy;
                closestDistance = distance;
            }
        }

        return closestEnemy;
    }

    protected getBestAdjacentStepAwayFromThreat(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        threatPosition: GridPosition,
    ): GridPosition | undefined {
        return computeBestAdjacentStepAwayFromThreat(gameState, controlledPlayer, threatPosition);
    }

    protected getEngagementGoals(gameState: GameSessionState, controlledPlayer: GameSessionPlayer, enemy: GameSessionPlayer): GridPosition[] {
        return CARDINAL_NEIGHBOR_OFFSETS.map((offset) => ({
            row: enemy.position.row + offset.row,
            column: enemy.position.column + offset.column,
        })).filter((position) => {
            if (position.row === controlledPlayer.position.row && position.column === controlledPlayer.position.column) {
                return false;
            }

            const cell = getSessionCellAt(gameState, position);
            if (!cell || isCellBlockedOnVirtualPlayerPath(cell)) {
                return false;
            }

            return !isOccupiedByAnotherPlayer(gameState, position, controlledPlayer.id);
        });
    }

    protected getFlagCell(gameState: GameSessionState): GridPosition | undefined {
        const flagCell = gameState.cells.find((cell) => cell.object === ObjectId.Flag);
        if (!flagCell) {
            return undefined;
        }

        return { row: flagCell.row, column: flagCell.column };
    }

    protected getSpawnPosition(controlledPlayer: GameSessionPlayer): GridPosition | undefined {
        return controlledPlayer.spawnPosition;
    }

    protected getPositionsClosestToTarget(gameState: GameSessionState, controlledPlayer: GameSessionPlayer, target: GridPosition): GridPosition[] {
        return gameState.cells
            .map((cell) => ({ row: cell.row, column: cell.column }))
            .filter((position) => {
                if (position.row === controlledPlayer.position.row && position.column === controlledPlayer.position.column) {
                    return false;
                }

                const cell = getSessionCellAt(gameState, position);
                if (!cell || isCellBlockedOnVirtualPlayerPath(cell)) {
                    return false;
                }

                return !isOccupiedByAnotherPlayer(gameState, position, controlledPlayer.id);
            })
            .sort((first, second) => {
                const firstDistance = this.getManhattanDistance(first, target);
                const secondDistance = this.getManhattanDistance(second, target);
                if (firstDistance !== secondDistance) {
                    return firstDistance - secondDistance;
                }

                const costFirst =
                    this.getShortestPathCostToGoals(gameState, controlledPlayer, controlledPlayer.position, [first]) ?? Number.POSITIVE_INFINITY;
                const costSecond =
                    this.getShortestPathCostToGoals(gameState, controlledPlayer, controlledPlayer.position, [second]) ?? Number.POSITIVE_INFINITY;
                return costFirst - costSecond;
            });
    }

    protected getAdjacentClosedDoor(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GridPosition | undefined {
        return this.getAdjacentPositionMatchingCell(
            gameState,
            controlledPlayer,
            (cell) => cell.tile === TileId.Door && cell.doorState !== DoorState.Open,
        );
    }

    protected getAdjacentOpenDoor(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GridPosition | undefined {
        return this.getAdjacentPositionMatchingCell(
            gameState,
            controlledPlayer,
            (cell) => cell.tile === TileId.Door && cell.doorState === DoorState.Open,
        );
    }

    protected getAdjacentHealSanctuary(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GridPosition | undefined {
        return this.getAdjacentShrine(gameState, controlledPlayer, ObjectId.Heal);
    }

    protected getAdjacentCombatSanctuary(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GridPosition | undefined {
        return this.getAdjacentShrine(gameState, controlledPlayer, ObjectId.Combat);
    }

    protected isCtfPlayer(controlledPlayer: GameSessionPlayer): boolean {
        return controlledPlayer.team === 'A' || controlledPlayer.team === 'B';
    }

    protected getManhattanDistance(first: GridPosition, second: GridPosition): number {
        return Math.abs(first.row - second.row) + Math.abs(first.column - second.column);
    }

    protected getGridSize(gameState: GameSessionState): GridSize {
        return gameState.gridSize;
    }

    protected createSanctuaryDecision(target: GridPosition, sanctuaryMode: SanctuaryActionMode = 'normal'): StrategyDecision {
        return {
            type: 'action',
            target,
            sanctuaryMode,
        };
    }

    protected getClosedDoorInteractionGoals(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): GridPosition[] {
        const goals = new Map<string, GridPosition>();

        for (const door of gameState.cells) {
            if (door.tile !== TileId.Door || door.doorState === DoorState.Open) {
                continue;
            }

            for (const offset of CARDINAL_NEIGHBOR_OFFSETS) {
                const position = { row: door.row + offset.row, column: door.column + offset.column };
                if (position.row === controlledPlayer.position.row && position.column === controlledPlayer.position.column) {
                    continue;
                }

                const cell = getSessionCellAt(gameState, position);
                if (!cell || isCellBlockedOnVirtualPlayerPath(cell)) {
                    continue;
                }

                if (isOccupiedByAnotherPlayer(gameState, position, controlledPlayer.id)) {
                    continue;
                }

                goals.set(toGridKey(position), position);
            }
        }

        return Array.from(goals.values());
    }

    protected getShortestPathCostToGoals(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        start: GridPosition,
        goals: GridPosition[],
        openedDoorPosition?: GridPosition,
    ): number | undefined {
        const goalKeys = new Set(goals.map((goal) => toGridKey(goal)));
        return computeShortestPathCostToGoalKeys(gameState, controlledPlayer, start, goalKeys, {
            openedClosedDoorKey: openedDoorPosition ? toGridKey(openedDoorPosition) : undefined,
        });
    }

    protected isAlreadyOnAnyGoal(controlledPlayer: GameSessionPlayer, goals: GridPosition[]): boolean {
        return goals.some((goal) => goal.row === controlledPlayer.position.row && goal.column === controlledPlayer.position.column);
    }

    protected createMoveDecision(target: GridPosition): StrategyDecision {
        return {
            type: 'move',
            target,
        };
    }

    protected resolvePrimaryMovementGoal(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        goals: GridPosition[],
    ): GridPosition | undefined {
        let best: GridPosition | undefined;
        let bestCost = Number.POSITIVE_INFINITY;

        for (const goal of goals) {
            const cost = this.getShortestPathCostToGoals(gameState, controlledPlayer, controlledPlayer.position, [goal]);
            if (cost === undefined) {
                continue;
            }

            const isTieBreakBetter =
                best !== undefined && cost === bestCost && (goal.row < best.row || (goal.row === best.row && goal.column < best.column));
            if (best === undefined || cost < bestCost || isTieBreakBetter) {
                best = goal;
                bestCost = cost;
            }
        }

        return best;
    }

    private getAdjacentShrine(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        shrineObject: ObjectId.Heal | ObjectId.Combat,
    ): GridPosition | undefined {
        return this.getAdjacentPositionMatchingCell(gameState, controlledPlayer, (cell, position) => {
            if (cell.object !== shrineObject) {
                return false;
            }

            if (shrineObject === ObjectId.Heal) {
                return canVirtualPlayerUseHealSanctuaryAt(gameState, controlledPlayer, position);
            }

            return canVirtualPlayerUseCombatSanctuaryAt(gameState, controlledPlayer, position);
        });
    }

    private getAdjacentPositionMatchingCell(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        predicate: (cell: NonNullable<ReturnType<typeof getSessionCellAt>>, position: GridPosition) => boolean,
    ): GridPosition | undefined {
        return CARDINAL_NEIGHBOR_OFFSETS.map((offset) => ({
            row: controlledPlayer.position.row + offset.row,
            column: controlledPlayer.position.column + offset.column,
        })).find((position) => {
            const cell = getSessionCellAt(gameState, position);
            if (!cell) {
                return false;
            }

            return predicate(cell, position);
        });
    }
}
