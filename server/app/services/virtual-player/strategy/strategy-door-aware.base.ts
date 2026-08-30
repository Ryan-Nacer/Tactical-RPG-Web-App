import { CARDINAL_NEIGHBOR_OFFSETS, DoorState, TileId } from '@common/game';
import { GameSessionPlayer, GameSessionState, GridPosition } from '@common/game-session';
import { getSessionCellAt, isCellBlockedOnVirtualPlayerPath, isOccupiedByAnotherPlayer } from './strategy-board.helper';
import { StrategyCoreBase } from './strategy-core.base';
import { StrategyDecision } from './strategy.types';

type DoorAwareDecisionOptions = {
    preferDoorShortcut?: boolean;
};

type ClosedDoorShortcutPlan = {
    doorPosition: GridPosition;
    interactionPosition: GridPosition;
    approachCost: number;
    postOpenCost: number;
    totalCost: number;
};

type DoorAwareDecisionContext = {
    bestDoorShortcut: ClosedDoorShortcutPlan | undefined;
    directPathCost: number | undefined;
    directStep: GridPosition | undefined;
    shouldPreferDoorShortcut: boolean;
};

const DOOR_OPEN_ACTION_PATH_COST = 1;
const TRACE_VP = process.env.VP_TRACE === '1';

export abstract class StrategyDoorAwareBase extends StrategyCoreBase {
    protected chooseDoorAwareCtfDecisionTowardsGoals(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        goals: GridPosition[],
        options: DoorAwareDecisionOptions = {},
    ): StrategyDecision | undefined {
        if (goals.length === 0 || this.isAlreadyOnAnyGoal(controlledPlayer, goals)) {
            return undefined;
        }

        const context = this.buildDoorAwareDecisionContext(gameState, controlledPlayer, goals, options);

        if (TRACE_VP) {
            this.logDoorAwareContext(controlledPlayer, goals, options, context);
        }

        const doorShortcutDecision = this.tryResolveDoorShortcutDecision(gameState, controlledPlayer, context);
        if (doorShortcutDecision) {
            return doorShortcutDecision;
        }

        if (!context.directStep) {
            return undefined;
        }

        if (TRACE_VP) {
            // eslint-disable-next-line no-console
            console.log(`[VP] choose move direct ${context.directStep.row},${context.directStep.column}`);
        }
        return this.createMoveDecision(context.directStep);
    }

    protected chooseDoorAwareDecisionTowardsFirstReachableGoal(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        goals: GridPosition[],
        preferDoorShortcut = false,
    ): StrategyDecision | undefined {
        for (const goal of goals) {
            const decision = this.chooseDoorAwareCtfDecisionTowardsGoals(gameState, controlledPlayer, [goal], {
                preferDoorShortcut,
            });
            if (decision) {
                return decision;
            }
        }

        return undefined;
    }

    private buildDoorAwareDecisionContext(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        goals: GridPosition[],
        options: DoorAwareDecisionOptions,
    ): DoorAwareDecisionContext {
        const directStep = this.chooseNextStepTowardsGoals(gameState, controlledPlayer, goals);
        const directPathCost = this.getShortestPathCostToGoals(gameState, controlledPlayer, controlledPlayer.position, goals);
        const bestDoorShortcut = this.findBestClosedDoorShortcutPlan(gameState, controlledPlayer, goals);
        const shouldPreferDoorShortcut =
            bestDoorShortcut !== undefined &&
            (options.preferDoorShortcut || bestDoorShortcut.totalCost <= (directPathCost ?? Number.POSITIVE_INFINITY));

        return { bestDoorShortcut, directPathCost, directStep, shouldPreferDoorShortcut };
    }

    private logDoorAwareContext(
        controlledPlayer: GameSessionPlayer,
        goals: GridPosition[],
        options: DoorAwareDecisionOptions,
        context: DoorAwareDecisionContext,
    ): void {
        const goalKeys = goals.map((goal) => `${goal.row},${goal.column}`).join('|');
        const doorInfo = context.bestDoorShortcut ? this.formatDoorShortcutInfo(context.bestDoorShortcut) : 'door=none';
        const directInfo = context.directPathCost !== undefined ? `directCost=${context.directPathCost}` : 'directCost=none';
        const stepInfo = context.directStep ? `directStep=${context.directStep.row},${context.directStep.column}` : 'directStep=none';

        // eslint-disable-next-line no-console
        console.log(
            `[VP] door-aware id=${controlledPlayer.id}` +
                ` pos=${controlledPlayer.position.row},${controlledPlayer.position.column}` +
                ` goals=${goalKeys} ${directInfo} ${doorInfo}` +
                ` preferDoor=${options.preferDoorShortcut ? '1' : '0'} ${stepInfo}`,
        );
    }

    private tryResolveDoorShortcutDecision(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        context: DoorAwareDecisionContext,
    ): StrategyDecision | undefined {
        if (!context.shouldPreferDoorShortcut || !context.bestDoorShortcut) {
            return undefined;
        }

        if (controlledPlayer.actionsLeft > 0 && this.getManhattanDistance(controlledPlayer.position, context.bestDoorShortcut.doorPosition) === 1) {
            if (TRACE_VP) {
                // eslint-disable-next-line no-console
                console.log(
                    `[VP] choose action open door at ${context.bestDoorShortcut.doorPosition.row},${context.bestDoorShortcut.doorPosition.column}`,
                );
            }
            return {
                type: 'action',
                target: context.bestDoorShortcut.doorPosition,
            };
        }

        const nextStepToDoor = this.chooseNextStepTowardsGoals(gameState, controlledPlayer, [context.bestDoorShortcut.interactionPosition]);
        if (!nextStepToDoor) {
            return undefined;
        }

        if (TRACE_VP) {
            // eslint-disable-next-line no-console
            console.log(`[VP] choose move to door interact ${nextStepToDoor.row},${nextStepToDoor.column}`);
        }
        return this.createMoveDecision(nextStepToDoor);
    }

    private findBestClosedDoorShortcutPlan(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        goals: GridPosition[],
    ): ClosedDoorShortcutPlan | undefined {
        let bestPlan: ClosedDoorShortcutPlan | undefined;

        for (const cell of gameState.cells) {
            if (cell.tile !== TileId.Door || cell.doorState === DoorState.Open) {
                continue;
            }

            const doorPosition = { row: cell.row, column: cell.column };
            const interactionPositions = this.getDoorInteractionPositions(gameState, controlledPlayer, doorPosition);
            for (const interactionPosition of interactionPositions) {
                const candidatePlan = this.buildClosedDoorShortcutPlan(gameState, controlledPlayer, goals, doorPosition, interactionPosition);
                if (candidatePlan && this.isBetterClosedDoorShortcutPlan(candidatePlan, bestPlan)) {
                    bestPlan = candidatePlan;
                }
            }
        }

        return bestPlan;
    }

    private buildClosedDoorShortcutPlan(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        goals: GridPosition[],
        doorPosition: GridPosition,
        interactionPosition: GridPosition,
    ): ClosedDoorShortcutPlan | undefined {
        const approachCost = this.getShortestPathCostToGoals(gameState, controlledPlayer, controlledPlayer.position, [interactionPosition]);
        if (approachCost === undefined) {
            return undefined;
        }

        const postOpenCost = this.getShortestPathCostToGoals(gameState, controlledPlayer, interactionPosition, goals, doorPosition);
        if (postOpenCost === undefined) {
            return undefined;
        }

        return {
            doorPosition,
            interactionPosition,
            approachCost,
            postOpenCost,
            totalCost: approachCost + DOOR_OPEN_ACTION_PATH_COST + postOpenCost,
        };
    }

    private isBetterClosedDoorShortcutPlan(candidate: ClosedDoorShortcutPlan, currentBest?: ClosedDoorShortcutPlan): boolean {
        if (!currentBest) {
            return true;
        }
        if (candidate.totalCost !== currentBest.totalCost) {
            return candidate.totalCost < currentBest.totalCost;
        }
        if (candidate.approachCost !== currentBest.approachCost) {
            return candidate.approachCost < currentBest.approachCost;
        }
        if (candidate.postOpenCost !== currentBest.postOpenCost) {
            return candidate.postOpenCost < currentBest.postOpenCost;
        }

        const doorComparison = this.comparePositions(candidate.doorPosition, currentBest.doorPosition);
        if (doorComparison !== 0) {
            return doorComparison < 0;
        }

        return this.comparePositions(candidate.interactionPosition, currentBest.interactionPosition) < 0;
    }

    private comparePositions(first: GridPosition, second: GridPosition): number {
        if (first.row !== second.row) {
            return first.row - second.row;
        }
        return first.column - second.column;
    }

    private formatDoorShortcutInfo(plan: ClosedDoorShortcutPlan): string {
        return (
            `door=${plan.doorPosition.row},${plan.doorPosition.column}` +
            ` interact=${plan.interactionPosition.row},${plan.interactionPosition.column}` +
            ` approach=${plan.approachCost}` +
            ` post=${plan.postOpenCost}` +
            ` total=${plan.totalCost}`
        );
    }

    private getDoorInteractionPositions(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        doorPosition: GridPosition,
    ): GridPosition[] {
        const positions: GridPosition[] = [];

        for (const offset of CARDINAL_NEIGHBOR_OFFSETS) {
            const position = { row: doorPosition.row + offset.row, column: doorPosition.column + offset.column };
            const cell = getSessionCellAt(gameState, position);
            if (!cell || isCellBlockedOnVirtualPlayerPath(cell)) {
                continue;
            }

            const isCurrentPosition = position.row === controlledPlayer.position.row && position.column === controlledPlayer.position.column;
            if (!isCurrentPosition && isOccupiedByAnotherPlayer(gameState, position, controlledPlayer.id)) {
                continue;
            }

            positions.push(position);
        }

        return positions;
    }
}
