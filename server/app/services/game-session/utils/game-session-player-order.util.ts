import { RoomState } from '@common/wait-room';

const DEFAULT_SPEED_TIE_BREAK_THRESHOLD = 0.5;

export function sortPlayersBySpeedDescending(
    players: RoomState['players'],
    random: () => number = Math.random,
    tieBreakThreshold = DEFAULT_SPEED_TIE_BREAK_THRESHOLD,
): RoomState['players'] {
    return [...players].sort((a, b) => {
        if (b.character.speed === a.character.speed) {
            return random() < tieBreakThreshold ? -1 : 1;
        }

        return b.character.speed - a.character.speed;
    });
}

export function shuffleArrayCopy<T>(array: T[]): T[] {
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
    }

    return shuffled;
}
