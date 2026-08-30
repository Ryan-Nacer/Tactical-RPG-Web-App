import { roomState } from '@app/services/game-session/game-session.service.spec.utils';
import {
    shuffleArrayCopy,
    sortPlayersBySpeedDescending,
} from '@app/services/game-session/utils/game-session-player-order.util';

/**
 * Portee :
 * - utilitaires d'ordre des joueurs (tri par vitesse et mélange)
 * Cas limites :
 * - aléa de departage en cas d'égalité
 * - immutabilité du tableau source lors du mélange
 */
/**
 * Strategie :
 * - tester game-session-player-order.util sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('game-session-player-order.util', () => {
    it('sorts players by speed descending', () => {
        const players = [
            { ...roomState.players[0], character: { ...roomState.players[0].character, speed: 3 } },
            { ...roomState.players[1], character: { ...roomState.players[1].character, speed: 7 } },
        ];

        const sorted = sortPlayersBySpeedDescending(players, () => 0.1);

        expect(sorted.map((player) => player.id)).toEqual(['player-2', 'player-1']);
    });

    it('uses random tie-break when speeds are equal', () => {
        const players = [
            { ...roomState.players[0], id: 'player-a', character: { ...roomState.players[0].character, speed: 5 } },
            { ...roomState.players[1], id: 'player-b', character: { ...roomState.players[1].character, speed: 5 } },
        ];

        const sortedLow = sortPlayersBySpeedDescending(players, () => 0.1, 0.5);
        const sortedHigh = sortPlayersBySpeedDescending(players, () => 0.9, 0.5);

        expect(sortedLow[0].id).toBe('player-b');
        expect(sortedHigh[0].id).toBe('player-a');
    });

    it('returns a shuffled copy and does not mutate source array', () => {
        const source = [1, 2, 3, 4, 5];
        const copyBefore = [...source];

        const shuffled = shuffleArrayCopy(source);

        expect(source).toEqual(copyBefore);
        expect(shuffled).toHaveLength(source.length);
        expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5]);
    });
});


