import { removePendingKeysForRoom } from './virtual-player-pending-keys.util';

/**
 * Strategie :
 * - tester removePendingKeysForRoom sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('removePendingKeysForRoom', () => {
    it('removes only keys prefixed with the room id', () => {
        const pending = new Set<string>(['ROOM01:a', 'ROOM01:b', 'ROOM02:c', 'ROOM01:d']);

        removePendingKeysForRoom('ROOM01', pending);

        expect([...pending].sort()).toEqual(['ROOM02:c']);
    });
});
