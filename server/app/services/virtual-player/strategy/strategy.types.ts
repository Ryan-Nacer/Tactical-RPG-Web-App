import { GridPosition, SanctuaryActionMode } from '@common/game-session';

export type StrategyDecision =
    | { type: 'none' }
    | { type: 'move'; target: GridPosition }
    | { type: 'action'; target: GridPosition; sanctuaryMode?: SanctuaryActionMode };
