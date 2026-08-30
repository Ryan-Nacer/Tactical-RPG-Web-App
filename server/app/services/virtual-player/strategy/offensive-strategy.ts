import { GameSessionPlayer, GameSessionState } from '@common/game-session';
import { Strategy, StrategyDecision } from './strategy';

const OFFENSIVE_EMERGENCY_HEAL_HP_RATIO = 0.35;

export class OffensiveStrategy extends Strategy {
    protected strategize(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision {
        if (this.isCtfPlayer(controlledPlayer)) {
            return this.tryCtfAggressiveDecision(gameState, controlledPlayer) ?? { type: 'none' };
        }

        return this.tryClassicAggressiveDecision(gameState, controlledPlayer) ?? { type: 'none' };
    }

    private tryClassicAggressiveDecision(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        return (
            this.tryAdjacentEnemyAttack(gameState, controlledPlayer) ??
            this.tryPursueEnemyWithDoorAwareness(gameState, controlledPlayer) ??
            this.tryAdjacentClosedDoorAction(gameState, controlledPlayer) ??
            this.tryMoveTowardsClosedDoor(gameState, controlledPlayer) ??
            this.tryEmergencySupportAction(gameState, controlledPlayer)
        );
    }

    private tryCtfAggressiveDecision(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (controlledPlayer.hasFlag) {
            const clearSpawnDecision = this.tryAttackEnemyOnOwnSpawn(gameState, controlledPlayer);
            if (clearSpawnDecision) {
                return clearSpawnDecision;
            }

            return this.tryCtfMoveTowardsOwnSpawn(gameState, controlledPlayer);
        }

        const allyFlagBearer = this.getAlliedFlagBearer(gameState, controlledPlayer);
        if (allyFlagBearer) {
            return this.tryClassicAggressiveDecision(gameState, controlledPlayer);
        }

        const enemyFlagBearer = this.getEnemyFlagBearer(gameState, controlledPlayer);
        if (enemyFlagBearer) {
            return this.tryCtfHuntEnemyFlagBearer(gameState, controlledPlayer, enemyFlagBearer);
        }

        return this.tryCtfCaptureLooseFlag(gameState, controlledPlayer);
    }

    private shouldEmergencyHealBeforeMovement(controlledPlayer: GameSessionPlayer): boolean {
        const threshold = Math.max(1, Math.ceil(controlledPlayer.maxHealth * OFFENSIVE_EMERGENCY_HEAL_HP_RATIO));
        return controlledPlayer.health <= threshold;
    }

    private tryAdjacentEnemyAttack(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (controlledPlayer.actionsLeft <= 0) {
            return undefined;
        }

        const adjacentEnemy = this.getAdjacentEnemy(gameState, controlledPlayer);
        if (!adjacentEnemy) {
            return undefined;
        }

        return {
            type: 'action',
            target: adjacentEnemy.position,
        };
    }

    private tryAdjacentHealSanctuaryWhenWounded(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (controlledPlayer.actionsLeft <= 0 || controlledPlayer.health >= controlledPlayer.maxHealth) {
            return undefined;
        }

        const healSanctuary = this.getAdjacentHealSanctuary(gameState, controlledPlayer);
        if (!healSanctuary) {
            return undefined;
        }

        return this.createSanctuaryDecision(healSanctuary);
    }

    private tryAdjacentCombatSanctuaryWhenNeeded(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (controlledPlayer.actionsLeft <= 0 || controlledPlayer.combatSanctuaryPointsLeft > 0) {
            return undefined;
        }

        const combatSanctuary = this.getAdjacentCombatSanctuary(gameState, controlledPlayer);
        if (!combatSanctuary) {
            return undefined;
        }

        return this.createSanctuaryDecision(combatSanctuary);
    }

    private tryCtfMoveTowardsOwnSpawn(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        const spawnPosition = this.getSpawnPosition(controlledPlayer);
        if (!spawnPosition) {
            return undefined;
        }

        if (controlledPlayer.position.row === spawnPosition.row && controlledPlayer.position.column === spawnPosition.column) {
            return undefined;
        }

        const directDecision = this.chooseDoorAwareCtfDecisionTowardsGoals(gameState, controlledPlayer, [spawnPosition], {
            preferDoorShortcut: true,
        });
        if (directDecision) {
            return directDecision;
        }

        // If spawn is temporarily unreachable (often because occupied), keep converging toward it.
        const fallbackGoals = this.getPositionsClosestToTarget(gameState, controlledPlayer, spawnPosition);
        return this.chooseDoorAwareDecisionTowardsFirstReachableGoal(gameState, controlledPlayer, fallbackGoals, true);
    }

    private tryCtfCaptureLooseFlag(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        const flagCell = this.getFlagCell(gameState);
        if (!flagCell) {
            return this.tryClassicAggressiveDecision(gameState, controlledPlayer);
        }

        const directFlagDecision = this.chooseDoorAwareCtfDecisionTowardsGoals(gameState, controlledPlayer, [flagCell], {
            preferDoorShortcut: true,
        });
        if (directFlagDecision) {
            return directFlagDecision;
        }

        const orderedGoalsClosestToFlag = this.getPositionsClosestToTarget(gameState, controlledPlayer, flagCell);
        const fallbackFlagDecision = this.chooseDoorAwareDecisionTowardsFirstReachableGoal(
            gameState,
            controlledPlayer,
            orderedGoalsClosestToFlag,
            true,
        );
        if (fallbackFlagDecision) {
            return fallbackFlagDecision;
        }

        const adjacentDoorAction = this.tryAdjacentClosedDoorAction(gameState, controlledPlayer);
        if (adjacentDoorAction) {
            return adjacentDoorAction;
        }

        const moveToClosedDoor = this.tryMoveTowardsClosedDoor(gameState, controlledPlayer);
        if (moveToClosedDoor) {
            return moveToClosedDoor;
        }

        return undefined;
    }

    private tryCtfHuntEnemyFlagBearer(
        gameState: GameSessionState,
        controlledPlayer: GameSessionPlayer,
        enemyFlagBearer: GameSessionPlayer,
    ): StrategyDecision | undefined {
        if (controlledPlayer.actionsLeft > 0 && this.getManhattanDistance(controlledPlayer.position, enemyFlagBearer.position) === 1) {
            return {
                type: 'action',
                target: enemyFlagBearer.position,
            };
        }

        return this.chooseDoorAwareCtfDecisionTowardsGoals(
            gameState,
            controlledPlayer,
            this.getEngagementGoals(gameState, controlledPlayer, enemyFlagBearer),
            { preferDoorShortcut: true },
        );
    }

    private tryEmergencySupportAction(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (this.shouldEmergencyHealBeforeMovement(controlledPlayer)) {
            const emergencyHeal = this.tryAdjacentHealSanctuaryWhenWounded(gameState, controlledPlayer);
            if (emergencyHeal) {
                return emergencyHeal;
            }
        }

        return this.tryAdjacentCombatSanctuaryWhenNeeded(gameState, controlledPlayer);
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

    private tryPursueEnemyWithDoorAwareness(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        const enemies = this.getEnemies(gameState, controlledPlayer);
        if (enemies.length === 0) {
            return undefined;
        }

        const closestEnemyByPath = this.getClosestEnemyByPath(gameState, controlledPlayer);
        const pursuitTarget = closestEnemyByPath ?? this.getClosestEnemyByManhattan(gameState, controlledPlayer);
        if (!pursuitTarget) {
            return undefined;
        }

        if (this.getManhattanDistance(controlledPlayer.position, pursuitTarget.position) === 1) {
            return undefined;
        }

        return this.chooseDoorAwareCtfDecisionTowardsGoals(
            gameState,
            controlledPlayer,
            this.getEngagementGoals(gameState, controlledPlayer, pursuitTarget),
        );
    }

    private tryMoveTowardsClosedDoor(gameState: GameSessionState, controlledPlayer: GameSessionPlayer): StrategyDecision | undefined {
        if (this.getAdjacentClosedDoor(gameState, controlledPlayer)) {
            return undefined;
        }

        const doorInteractionGoals = this.getClosedDoorInteractionGoals(gameState, controlledPlayer);
        if (doorInteractionGoals.length === 0) {
            return undefined;
        }

        const nextStep = this.chooseNextStepTowardsGoals(gameState, controlledPlayer, doorInteractionGoals);
        if (!nextStep) {
            return undefined;
        }

        return { type: 'move', target: nextStep };
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
}
