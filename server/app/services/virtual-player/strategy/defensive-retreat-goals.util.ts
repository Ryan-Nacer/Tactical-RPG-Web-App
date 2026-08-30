import { GridPosition } from '@common/game-session';

/** Nombre de cases cibles pour la fuite : assez pour le pathfinding, sans traiter toute la grille comme un seul ensemble de buts. */
export const RETREAT_GOAL_LIMIT = 8;

/**
 * `positionsSortedByDistanceAscending` : positions libres (ou position du joueur), triées par distance
 * Manhattan croissante vers la menace (les premières entrées sont les plus proches de la menace).
 * Retourne jusqu'à `maxGoals` positions les plus éloignées de la menace, pour servir de buts de repli au pathfinding.
 */
export function selectFarthestRetreatGoalsFromThreat(positionsSortedByDistanceAscending: GridPosition[], maxGoals: number): GridPosition[] {
    if (positionsSortedByDistanceAscending.length === 0 || maxGoals <= 0) {
        return [];
    }

    const take = Math.min(maxGoals, positionsSortedByDistanceAscending.length);
    return positionsSortedByDistanceAscending.slice(-take);
}
