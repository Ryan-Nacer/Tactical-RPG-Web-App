import { GameSessionState } from '@common/game-session';
import { Playstyle } from '@common/wait-room';
import { Strategy } from './strategy/strategy';

export type VirtualPlayerController = {
    playstyle: Playstyle;
    strategy: Strategy;
};

export type VirtualPlayerSnapshot = {
    phase: GameSessionState['phase'];
    activePlayerId: string;
    row: number;
    column: number;
    movementPointsLeft: number;
    actionsLeft: number;
    hasFlag: boolean;
    messagesCount: number;
};
