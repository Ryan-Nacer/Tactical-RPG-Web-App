import { RETREAT_GOAL_LIMIT, selectFarthestRetreatGoalsFromThreat } from './defensive-retreat-goals.util';

/**
 * Strategie :
 * - tester selectFarthestRetreatGoalsFromThreat sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('selectFarthestRetreatGoalsFromThreat', () => {
    it('returns empty array when input is empty', () => {
        expect(selectFarthestRetreatGoalsFromThreat([], RETREAT_GOAL_LIMIT)).toEqual([]);
    });

    it('returns empty array when maxGoals is zero', () => {
        const positions = [{ row: 0, column: 0 }];
        expect(selectFarthestRetreatGoalsFromThreat(positions, 0)).toEqual([]);
    });

    it('returns the last K entries of an ascending-by-distance-to-threat list', () => {
        const ascendingFromThreat = [
            { row: 5, column: 5 },
            { row: 4, column: 5 },
            { row: 3, column: 5 },
            { row: 2, column: 5 },
        ];

        expect(selectFarthestRetreatGoalsFromThreat(ascendingFromThreat, 2)).toEqual([
            { row: 3, column: 5 },
            { row: 2, column: 5 },
        ]);
    });

    it('returns all positions when fewer than maxGoals', () => {
        const positions = [
            { row: 0, column: 0 },
            { row: 0, column: 1 },
        ];
        expect(selectFarthestRetreatGoalsFromThreat(positions, RETREAT_GOAL_LIMIT)).toEqual(positions);
    });
});
