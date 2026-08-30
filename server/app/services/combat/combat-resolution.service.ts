import {
    CombatPosture,
    CombatTurnResult,
    DEFENSIVE_POSTURE_DEFENSE_BONUS,
    getDiceMaxValue,
    getDiceMinValue,
    ICE_TILE_COMBAT_PENALTY,
    OFFENSIVE_POSTURE_ATTACK_BONUS,
    SimultaneousCombatTurnResult,
} from '@common/combat';
import { TileId } from '@common/game';
import { GameDice, GameSessionPlayer, GameSessionState } from '@common/game-session';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CombatResolutionService {
    rollDice(diceType: GameDice, debugMode: boolean, isInstigator: boolean): number {
        if (debugMode) {
            return isInstigator ? getDiceMaxValue(diceType) : getDiceMinValue(diceType);
        }

        const maxValue = getDiceMaxValue(diceType);
        const minValue = getDiceMinValue(diceType);
        return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
    }

    getPostureBonus(posture: CombatPosture, attributeType: 'attack' | 'defense'): number {
        if (posture === CombatPosture.Offensive && attributeType === 'attack') {
            return OFFENSIVE_POSTURE_ATTACK_BONUS;
        }
        if (posture === CombatPosture.Defensive && attributeType === 'defense') {
            return DEFENSIVE_POSTURE_DEFENSE_BONUS;
        }
        return 0;
    }

    getTerrainPenalty(session: GameSessionState, playerId: string): number {
        const player = session.players.find((p) => p.id === playerId);
        if (!player) {
            return 0;
        }

        const cell = session.cells.find((c) => c.row === player.position.row && c.column === player.position.column);
        if (!cell) {
            return 0;
        }

        return cell.tile === TileId.Ice ? ICE_TILE_COMBAT_PENALTY : 0;
    }

    resolveCombatTurn(
        session: GameSessionState,
        attacker: GameSessionPlayer,
        defender: GameSessionPlayer,
        attackerPosture: CombatPosture,
        defenderPosture: CombatPosture,
    ): CombatTurnResult {
        const isAttackerInstigator = session.combatState?.attackerId === attacker.id;

        const attackerDiceRoll = this.rollDice(attacker.attackDice, session.debugMode, isAttackerInstigator);
        const defenderDiceRoll = this.rollDice(defender.defenseDice, session.debugMode, !isAttackerInstigator);

        const attackerPostureBonus = this.getPostureBonus(attackerPosture, 'attack');
        const attackerTerrainPenalty = this.getTerrainPenalty(session, attacker.id);
        const attackerTotal = attacker.attack + attackerPostureBonus + attackerDiceRoll + attacker.combatSanctuaryPointsLeft - attackerTerrainPenalty;

        const defenderPostureBonus = this.getPostureBonus(defenderPosture, 'defense');
        const defenderTerrainPenalty = this.getTerrainPenalty(session, defender.id);
        const defenderTotal =
            defender.defense + defenderPostureBonus + defenderDiceRoll + defender.combatSanctuaryPointsLeft - defenderTerrainPenalty;

        const damageDealt = Math.max(0, attackerTotal - defenderTotal);
        const defenderHealthAfter = Math.max(0, defender.health - damageDealt);

        return {
            attackerId: attacker.id,
            defenderId: defender.id,
            attackerPosture,
            attackerAttackBase: attacker.attack,
            attackerAttackPostureBonus: attackerPostureBonus,
            attackerAttackDiceRoll: attackerDiceRoll,
            attackerAttackPenalty: attackerTerrainPenalty,
            attackerAttackTotal: attackerTotal,
            defenderPosture,
            defenderDefenseBase: defender.defense,
            defenderDefensePostureBonus: defenderPostureBonus,
            defenderDefenseDiceRoll: defenderDiceRoll,
            defenderDefensePenalty: defenderTerrainPenalty,
            defenderDefenseTotal: defenderTotal,
            damageDealt,
            defenderHealthAfter,
        };
    }

    resolveCombatTurnSimultaneous(
        session: GameSessionState,
        attacker: GameSessionPlayer,
        defender: GameSessionPlayer,
        attackerPosture: CombatPosture,
        defenderPosture: CombatPosture,
    ): SimultaneousCombatTurnResult {
        const isAttackerInstigator = session.combatState?.attackerId === attacker.id;

        const attackerAttackDiceRoll = this.rollDice(attacker.attackDice, session.debugMode, isAttackerInstigator);
        const defenderDefenseDiceRoll = this.rollDice(defender.defenseDice, session.debugMode, !isAttackerInstigator);
        const defenderAttackDiceRoll = this.rollDice(defender.attackDice, session.debugMode, !isAttackerInstigator);
        const attackerDefenseDiceRoll = this.rollDice(attacker.defenseDice, session.debugMode, isAttackerInstigator);

        const attackerAttackPostureBonus = this.getPostureBonus(attackerPosture, 'attack');
        const attackerDefensePostureBonus = this.getPostureBonus(attackerPosture, 'defense');
        const defenderAttackPostureBonus = this.getPostureBonus(defenderPosture, 'attack');
        const defenderDefensePostureBonus = this.getPostureBonus(defenderPosture, 'defense');

        const attackerPenalty = this.getTerrainPenalty(session, attacker.id);
        const defenderPenalty = this.getTerrainPenalty(session, defender.id);

        const attackerAttackTotal =
            attacker.attack + attackerAttackPostureBonus + attackerAttackDiceRoll + attacker.combatSanctuaryPointsLeft - attackerPenalty;
        const defenderDefenseTotal =
            defender.defense + defenderDefensePostureBonus + defenderDefenseDiceRoll + defender.combatSanctuaryPointsLeft - defenderPenalty;

        const defenderAttackTotal =
            defender.attack + defenderAttackPostureBonus + defenderAttackDiceRoll + defender.combatSanctuaryPointsLeft - defenderPenalty;
        const attackerDefenseTotal =
            attacker.defense + attackerDefensePostureBonus + attackerDefenseDiceRoll + attacker.combatSanctuaryPointsLeft - attackerPenalty;

        const damageToDefender = Math.max(0, attackerAttackTotal - defenderDefenseTotal);
        const damageToAttacker = Math.max(0, defenderAttackTotal - attackerDefenseTotal);

        const defenderHealthAfter = Math.max(0, defender.health - damageToDefender);
        const attackerHealthAfter = Math.max(0, attacker.health - damageToAttacker);

        const attackerToDefender: CombatTurnResult = {
            attackerId: attacker.id,
            defenderId: defender.id,
            attackerPosture,
            attackerAttackBase: attacker.attack,
            attackerAttackPostureBonus,
            attackerAttackDiceRoll,
            attackerAttackPenalty: attackerPenalty,
            attackerAttackTotal,
            defenderPosture,
            defenderDefenseBase: defender.defense,
            defenderDefensePostureBonus,
            defenderDefenseDiceRoll,
            defenderDefensePenalty: defenderPenalty,
            defenderDefenseTotal,
            damageDealt: damageToDefender,
            defenderHealthAfter,
        };

        const defenderToAttacker: CombatTurnResult = {
            attackerId: defender.id,
            defenderId: attacker.id,
            attackerPosture: defenderPosture,
            attackerAttackBase: defender.attack,
            attackerAttackPostureBonus: defenderAttackPostureBonus,
            attackerAttackDiceRoll: defenderAttackDiceRoll,
            attackerAttackPenalty: defenderPenalty,
            attackerAttackTotal: defenderAttackTotal,
            defenderPosture: attackerPosture,
            defenderDefenseBase: attacker.defense,
            defenderDefensePostureBonus: attackerDefensePostureBonus,
            defenderDefenseDiceRoll: attackerDefenseDiceRoll,
            defenderDefensePenalty: attackerPenalty,
            defenderDefenseTotal: attackerDefenseTotal,
            damageDealt: damageToAttacker,
            defenderHealthAfter: attackerHealthAfter,
        };

        return {
            attackerToDefender,
            defenderToAttacker,
            damageToDefender,
            damageToAttacker,
            defenderHealthAfter,
            attackerHealthAfter,
        };
    }
}
