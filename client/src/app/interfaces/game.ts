// Mesure Temporaire. Les cells de cette interface va être différente de celle
// de GameCommon
import { GameCell, Mode, Game as GameCommon } from '@common/game';

export enum GridSize {
    Small = 10,
    Medium = 15,
    Large = 20,
}

export interface Game {
    id: string;
    name: string;
    size: GridSize;
    lastModified: string;
    imageURL?: string;
    description: string;
    mode: Mode;
    isVisible: boolean;
    cells: GameCell[];
}

export function toGameCommon(game: Game): GameCommon {
    return {
        ...game,
        size: String(game.size),
    };
}

export const emptyGame = (): Game => ({
    id: '',
    name: '',
    size: GridSize.Small,
    lastModified: '',
    description: '',
    mode: Mode.Classic,
    isVisible: false,
    cells: [],
});
