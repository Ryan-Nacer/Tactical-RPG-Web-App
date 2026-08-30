import { GameDice } from './game-session';

export enum CombatPosture {
    Neutral = 'NEUTRAL',
    Offensive = 'OFFENSIVE',
    Defensive = 'DEFENSIVE',
}

export interface CombatTurnResult {
    attackerId: string;
    defenderId: string;
    
    attackerPosture: CombatPosture;
    attackerAttackBase: number;
    attackerAttackPostureBonus: number;
    attackerAttackDiceRoll: number;
    attackerAttackPenalty: number;
    attackerAttackTotal: number;
    
    defenderPosture: CombatPosture;
    defenderDefenseBase: number;
    defenderDefensePostureBonus: number;
    defenderDefenseDiceRoll: number;
    defenderDefensePenalty: number;
    defenderDefenseTotal: number;
    
    damageDealt: number;
    defenderHealthAfter: number;
}

export interface CombatResult {
    turns: CombatTurnResult[];
    winnerId?: string;
    loserId?: string;
}

export interface SimultaneousCombatTurnResult {
    attackerToDefender: CombatTurnResult;
    defenderToAttacker: CombatTurnResult;
    damageToDefender: number;
    damageToAttacker: number;
    defenderHealthAfter: number;
    attackerHealthAfter: number;
}

export interface CombatState {
    attackerId: string;
    defenderId: string;
    currentTurnNumber: number;
    attackerPosture?: CombatPosture;
    defenderPosture?: CombatPosture;
    turnsHistory: CombatTurnResult[];
}

export const COMBAT_TURN_DURATION_SECONDS = 10;
export const OFFENSIVE_POSTURE_ATTACK_BONUS = 2;
export const DEFENSIVE_POSTURE_DEFENSE_BONUS = 2;
export const ICE_TILE_COMBAT_PENALTY = 2;

export const D4_MIN_VALUE = 1;
export const D4_MAX_VALUE = 4;
export const D6_MIN_VALUE = 1;
export const D6_MAX_VALUE = 6;

export function getDiceMinValue(diceType: GameDice): number {
    return diceType === 'D4' ? D4_MIN_VALUE : D6_MIN_VALUE;
}

export function getDiceMaxValue(diceType: GameDice): number {
    return diceType === 'D4' ? D4_MAX_VALUE : D6_MAX_VALUE;
}
