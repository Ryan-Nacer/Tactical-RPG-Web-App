import { AvatarName, PlayerAvatar } from '@common/player';
import { PlayerCharacter } from '@common/wait-room';

const DEFAULT_HEALTH = 6;
const DEFAULT_SPEED = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;
const FIFTY_PERCENT_THRESHOLD = 0.5;
/** Noms possibles pour les joueurs virtuels (un seul joueur par nom dans une salle). */
export const VIRTUAL_PLAYER_NAME_POOL: readonly string[] = [
    'Botanix',
    'Botimus',
    'Circuit',
    'Pixel',
    'Nova',
    'Vector',
    'Glitch',
    'Nexus',
    'Raptor',
    'Cipher',
    'Helix',
    'Orbit',
];

export function getRandomAvatar(unavailableAvatars: AvatarName[], avatarList: PlayerAvatar[]): PlayerAvatar | undefined {
    const availableAvatars = avatarList.filter((avatar) => !unavailableAvatars.includes(avatar.avatarName));
    if (availableAvatars.length === 0) {
        return undefined;
    }

    return availableAvatars[Math.floor(Math.random() * availableAvatars.length)];
}

/**
 * Choisit un nom au hasard parmi la liste prédéterminée, hors noms déjà pris (comparaison insensible à la casse).
 * @returns `undefined` si tous les noms du pool sont utilisés — ne pas inventer de suffixe (ex. Botanix-2).
 */
export function getRandomVirtualPlayerName(unavailableNames: string[]): string | undefined {
    const normalizedUnavailableNames = new Set(unavailableNames.map((name) => name.toLowerCase()));
    const availableNames = VIRTUAL_PLAYER_NAME_POOL.filter((name) => !normalizedUnavailableNames.has(name.toLowerCase()));
    if (availableNames.length === 0) {
        return undefined;
    }

    return availableNames[Math.floor(Math.random() * availableNames.length)];
}

export function createRandomCharacter(): PlayerCharacter {
    const receivesHealthBonus = Math.random() < FIFTY_PERCENT_THRESHOLD;
    const health = DEFAULT_HEALTH + (receivesHealthBonus ? 2 : 0);
    const speed = DEFAULT_SPEED + (receivesHealthBonus ? 0 : 2);
    const attackUsesD4 = Math.random() < FIFTY_PERCENT_THRESHOLD;

    return {
        health,
        maxHealth: health,
        speed,
        attack: DEFAULT_ATTACK,
        defense: DEFAULT_DEFENSE,
        attackDice: attackUsesD4 ? 'D4' : 'D6',
        defenseDice: attackUsesD4 ? 'D6' : 'D4',
        movementPointsLeft: speed,
        combatSanctuaryPointsLeft: 0,
        actionsLeft: 1,
    };
}
