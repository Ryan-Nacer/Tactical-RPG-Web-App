import { GameSessionPlayer, GameSessionState, GridPosition } from '@common/game-session';
import { RETREAT_GOAL_LIMIT, selectFarthestRetreatGoalsFromThreat } from './defensive-retreat-goals.util';
import { Strategy, StrategyDecision } from './strategy';

const DEFENSIVE_CRITICAL_HEAL_HP_RATIO = 0.4;
const DEFENSIVE_COMBAT_SANCTUARY_THREAT_DISTANCE = 2;

export class DefensiveStrategy extends Strategy {
    protected strategize(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision {
        if (this.isCtfPlayer(controlledPlayer)) {
            return (
                this.tryCtfDefensiveDecision(gameState, controlledPlayer) ??
                this.tryClassicDefensiveDecision(gameState, controlledPlayer) ?? { type: 'none' }
            );
        }

        return this.tryClassicDefensiveDecision(gameState, controlledPlayer) ?? { type: 'none' };
    }

    private tryClassicDefensiveDecision(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        return (
            this.tryRetreatFromAdjacentEnemy(gameState, controlledPlayer) ??
            this.tryGeneralRetreat(gameState, controlledPlayer) ??
            this.tryAdjacentHealSanctuary(gameState, controlledPlayer) ??
            this.tryAdjacentCombatSanctuary(gameState, controlledPlayer) ??
            this.tryAdjacentClosedDoorAction(gameState, controlledPlayer)
        );
    }

    private tryCtfDefensiveDecision(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (controlledPlayer.hasFlag) {
            const clearSpawnDecision = this.tryAttackEnemyOnOwnSpawn(gameState, controlledPlayer);
            if (clearSpawnDecision) {
                return clearSpawnDecision;
            }

            return this.tryMoveToTargetWithDoorAwareness(gameState, controlledPlayer, this.getSpawnPosition(controlledPlayer));
        }

        const allyFlagBearer = this.getAlliedFlagBearer(gameState, controlledPlayer);
        if (allyFlagBearer) {
            return this.tryClassicDefensiveDecision(gameState, controlledPlayer);
        }

        const enemyFlagBearer = this.getEnemyFlagBearer(gameState, controlledPlayer);
        if (enemyFlagBearer) {
            return this.tryMoveToTargetWithDoorAwareness(gameState, controlledPlayer, this.getSpawnPosition(enemyFlagBearer));
        }

        return this.tryMoveToTargetWithDoorAwareness(gameState, controlledPlayer, this.getFlagCell(gameState));
    }

    private tryAdjacentHealSanctuary(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (controlledPlayer.actionsLeft <= 0 || !this.shouldPrioritizeHealSanctuary(controlledPlayer)) {
            return undefined;
        }

        const healSanctuary = this.getAdjacentHealSanctuary(gameState, controlledPlayer);
        if (!healSanctuary) {
            return undefined;
        }

        return this.createSanctuaryDecision(healSanctuary);
    }

    private tryAdjacentCombatSanctuary(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (controlledPlayer.actionsLeft <= 0 || controlledPlayer.combatSanctuaryPointsLeft > 0) {
            return undefined;
        }

        if (!this.isCombatSanctuaryAdvantageous(gameState, controlledPlayer)) {
            return undefined;
        }

        const combatSanctuary = this.getAdjacentCombatSanctuary(gameState, controlledPlayer);
        if (!combatSanctuary) {
            return undefined;
        }

        return this.createSanctuaryDecision(combatSanctuary);
    }

    private tryRetreatFromAdjacentEnemy(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        const adjacentEnemy = this.getAdjacentEnemy(gameState, controlledPlayer);
        if (!adjacentEnemy) {
            return undefined;
        }

        const retreatStep = this.findRetreatStep(gameState, controlledPlayer, adjacentEnemy.position);
        if (!retreatStep) {
            return undefined;
        }

        return { type: 'move', target: retreatStep };
    }

    private tryAdjacentClosedDoorAction(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (controlledPlayer.actionsLeft <= 0) {
            return undefined;
        }

        const adjacentClosedDoor = this.getAdjacentClosedDoor(gameState, controlledPlayer);
        if (!adjacentClosedDoor) {
            return undefined;
        }

        return {
            type: 'action',
            target: adjacentClosedDoor,
        };
    }

    private tryGeneralRetreat(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        const closestEnemy = this.getClosestEnemyByPath(gameState, controlledPlayer);
        if (!closestEnemy) {
            return undefined;
        }

        const maxDistanceStep = this.getBestAdjacentStepAwayFromThreat(gameState, controlledPlayer, closestEnemy.position);
        if (maxDistanceStep) {
            return { type: 'move', target: maxDistanceStep };
        }

        const sortedByDistanceToThreat = this.getPositionsClosestToTarget(gameState, controlledPlayer, closestEnemy.position);
        const retreatGoals = selectFarthestRetreatGoalsFromThreat(sortedByDistanceToThreat, RETREAT_GOAL_LIMIT).reverse();
        const primaryRetreatStep = this.chooseStepTowardsFirstReachableGoal(gameState, controlledPlayer, retreatGoals);
        if (primaryRetreatStep) {
            return { type: 'move', target: primaryRetreatStep };
        }

        const fallbackRetreatStep = this.chooseStepTowardsFirstReachableGoal(gameState, controlledPlayer, [...sortedByDistanceToThreat].reverse());
        if (fallbackRetreatStep) {
            return { type: 'move', target: fallbackRetreatStep };
        }

        return undefined;
    }

    private findRetreatStep(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        threatPosition: GridPosition,
    ): GridPosition | undefined {
        const ownSpawn = this.getSpawnPosition(controlledPlayer);
        if (ownSpawn) {
            const nextStepToSpawn = this.chooseNextStepTowardsGoals(gameState, controlledPlayer, [ownSpawn]);
            if (nextStepToSpawn && this.getManhattanDistance(nextStepToSpawn, threatPosition) > 1) {
                return nextStepToSpawn;
            }
        }

        const sortedByDistanceToThreat = this.getPositionsClosestToTarget(gameState, controlledPlayer, threatPosition);
        const retreatGoals = selectFarthestRetreatGoalsFromThreat(sortedByDistanceToThreat, RETREAT_GOAL_LIMIT).reverse();
        const retreatStep = this.chooseStepTowardsFirstReachableGoal(gameState, controlledPlayer, retreatGoals);
        if (retreatStep) {
            return retreatStep;
        }

        return this.chooseStepTowardsFirstReachableGoal(gameState, controlledPlayer, [...sortedByDistanceToThreat].reverse());
    }

    private shouldPrioritizeHealSanctuary(controlledPlayer: GameSessionPlayer): boolean {
        if (controlledPlayer.health >= controlledPlayer.maxHealth) {
            return false;
        }

        const criticalHealthThreshold = Math.max(1, Math.ceil(controlledPlayer.maxHealth * DEFENSIVE_CRITICAL_HEAL_HP_RATIO));
        return controlledPlayer.health <= criticalHealthThreshold;
    }

    private isCombatSanctuaryAdvantageous(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): boolean {
        const adjacentEnemy = this.getAdjacentEnemy(gameState, controlledPlayer);
        if (adjacentEnemy) {
            return true;
        }

        const enemyFlagBearer = this.getEnemies(gameState, controlledPlayer).find((enemy) => enemy.hasFlag);
        if (
            enemyFlagBearer &&
            this.getManhattanDistance(controlledPlayer.position, enemyFlagBearer.position) <= DEFENSIVE_COMBAT_SANCTUARY_THREAT_DISTANCE
        ) {
            return true;
        }

        const closestEnemy = this.getClosestEnemyByPath(gameState, controlledPlayer);
        return (
            closestEnemy !== undefined &&
            this.getManhattanDistance(controlledPlayer.position, closestEnemy.position) <= DEFENSIVE_COMBAT_SANCTUARY_THREAT_DISTANCE
        );
    }

    private tryMoveToTargetWithDoorAwareness(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        target: GridPosition | undefined,
    ): StrategyDecision | undefined {
        if (!target) {
            return undefined;
        }

        if (controlledPlayer.position.row === target.row && controlledPlayer.position.column === target.column) {
            return { type: 'none' };
        }

        const directDecision = this.chooseDoorAwareCtfDecisionTowardsGoals(gameState, controlledPlayer, [target], {
            preferDoorShortcut: true,
        });
        if (directDecision) {
            return directDecision;
        }

        const fallbackGoals = this.getPositionsClosestToTarget(gameState, controlledPlayer, target);
        return this.chooseDoorAwareDecisionTowardsFirstReachableGoal(gameState, controlledPlayer, fallbackGoals, true);
    }

    private chooseStepTowardsFirstReachableGoal(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        goals: GridPosition[],
    ): GridPosition | undefined {
        for (const goal of goals) {
            const step = this.chooseNextStepTowardsGoals(gameState, controlledPlayer, [goal]);
            if (step) {
                return step;
            }
        }

        return undefined;
    }

    private tryAttackEnemyOnOwnSpawn(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (controlledPlayer.actionsLeft <= 0) {
            return undefined;
        }

        const ownSpawn = this.getSpawnPosition(controlledPlayer);
        if (!ownSpawn) {
            return undefined;
        }

        const enemyOnOwnSpawn = this.getEnemies(gameState, controlledPlayer).find(
            (enemy) => enemy.position.row === ownSpawn.row && enemy.position.column === ownSpawn.column,
        );
        if (!enemyOnOwnSpawn) {
            return undefined;
        }

        if (this.getManhattanDistance(controlledPlayer.position, enemyOnOwnSpawn.position) !== 1) {
            return undefined;
        }

        return {
            type: 'action',
            target: enemyOnOwnSpawn.position,
        };
    }
}
