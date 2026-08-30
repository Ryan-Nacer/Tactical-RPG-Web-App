import { GridSize } from '@common/game';

export const GRID_SIZE_TO_PLAYER_COUNT_MAP = {
    [GridSize.Small]: 2,
    [GridSize.Medium]: 4,
    [GridSize.Large]: 6,
};

export const ERROR_MESSAGES = {
    loadGamesError: 'Erreur lors du chargement des jeux',
    gameAlreadyDeleted: 'Ce jeu a déjà été supprimé.',
    deleteGameError: 'Impossible de supprimer le jeu. Réessayez.',
    toggleVisibilityError: 'Impossible de modifier la visibilité du jeu. Réessayez.',
} as const;
