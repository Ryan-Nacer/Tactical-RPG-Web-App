import { getRandomVirtualPlayerName, VIRTUAL_PLAYER_NAME_POOL } from './room.service.utils';

/**
 * Strategie :
 * - tester room.service.utils (joueurs virtuels) sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('room.service.utils (joueurs virtuels)', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('getRandomVirtualPlayerName should return undefined when every pool name is taken', () => {
        const unavailable = [...VIRTUAL_PLAYER_NAME_POOL];

        expect(getRandomVirtualPlayerName(unavailable)).toBeUndefined();
    });

    it('getRandomVirtualPlayerName should ignore casing when matching taken names', () => {
        const result = getRandomVirtualPlayerName(['botanix']);

        expect(result).toBeDefined();
        expect(result).not.toBe('Botanix');
    });

    it('getRandomVirtualPlayerName should return only from remaining names', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = getRandomVirtualPlayerName([]);

        expect(result).toBe(VIRTUAL_PLAYER_NAME_POOL[0]);
    });
});
