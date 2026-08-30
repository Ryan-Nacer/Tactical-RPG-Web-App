export const VIRTUAL_PLAYER_MAX_INITIAL_TURN_DELAY_MS = 1200;
export const VIRTUAL_PLAYER_MAX_DECISIONS_PER_TURN = 30;

const MIN_DECISION_DELAY_MS = 250;
const DECISION_DELAY_RANGE_MS = 450;
const MIN_GLIDE_DECISION_DELAY_MS = 40;
const GLIDE_DECISION_DELAY_RANGE_MS = 60;
const MIN_COMBAT_DECISION_DELAY_MS = 250;
const COMBAT_DECISION_DELAY_RANGE_MS = 350;
const MIN_POST_COMBAT_TURN_DELAY_MS = 900;
const POST_COMBAT_TURN_DELAY_RANGE_MS = 700;
const MIN_FLAG_TRANSFER_DELAY_MS = 250;
const FLAG_TRANSFER_DELAY_RANGE_MS = 350;

export function randomVirtualPlayerDecisionDelayMs(): number {
    return MIN_DECISION_DELAY_MS + Math.random() * DECISION_DELAY_RANGE_MS;
}

export function randomVirtualPlayerGlideDecisionDelayMs(): number {
    return MIN_GLIDE_DECISION_DELAY_MS + Math.random() * GLIDE_DECISION_DELAY_RANGE_MS;
}

export function randomVirtualPlayerCombatDecisionDelayMs(): number {
    return MIN_COMBAT_DECISION_DELAY_MS + Math.random() * COMBAT_DECISION_DELAY_RANGE_MS;
}

export function randomVirtualPlayerPostCombatTurnDelayMs(): number {
    return MIN_POST_COMBAT_TURN_DELAY_MS + Math.random() * POST_COMBAT_TURN_DELAY_RANGE_MS;
}

export function randomVirtualPlayerFlagTransferDelayMs(): number {
    return MIN_FLAG_TRANSFER_DELAY_MS + Math.random() * FLAG_TRANSFER_DELAY_RANGE_MS;
}
