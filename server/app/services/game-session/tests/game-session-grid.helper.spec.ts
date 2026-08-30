import {
    cloneSessionCell,
    getManhattanDistance,
    isBlockedTraversalCell,
    isShrineObject,
} from '@app/services/game-session/utils/game-session-grid.helper';
import { DoorState, ObjectId, TileId } from '@common/game';

/**
 * Portee :
 * - utilitaires purs de grille
 * Cas limites :
 * - detection des objets sanctuaire
 * - règles de blocage de déplacement
 * - valeurs par defaut clonees pour portes/sanctuaires
 */
/**
 * Strategie :
 * - tester game-session-grid.helper sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('game-session-grid.helper', () => {
    it('computes Manhattan distance correctly', () => {
        expect(getManhattanDistance({ row: 1, column: 2 }, { row: 4, column: 6 })).toBe(7);
    });

    it('detects shrine objects', () => {
        expect(isShrineObject(ObjectId.Heal)).toBe(true);
        expect(isShrineObject(ObjectId.Combat)).toBe(true);
        expect(isShrineObject(ObjectId.Flag)).toBe(false);
        expect(isShrineObject(undefined)).toBe(false);
    });

    it('marks traversal blocked for walls, closed doors and shrines', () => {
        expect(isBlockedTraversalCell({ row: 0, column: 0, tile: TileId.Wall })).toBe(true);
        expect(isBlockedTraversalCell({ row: 0, column: 0, tile: TileId.Door, doorState: DoorState.Closed })).toBe(true);
        expect(isBlockedTraversalCell({ row: 0, column: 0, tile: TileId.Base, object: ObjectId.Heal })).toBe(true);
        expect(isBlockedTraversalCell({ row: 0, column: 0, tile: TileId.Door, doorState: DoorState.Open })).toBe(false);
    });

    it('clones a session cell and applies defaults for door and shrine flags', () => {
        const doorCell = cloneSessionCell({ row: 1, column: 1, tile: TileId.Door, doorState: DoorState.Open });
        expect(doorCell.doorManipulated).toBe(false);

        const shrineCell = cloneSessionCell({ row: 2, column: 2, tile: TileId.Base, object: ObjectId.Heal });
        expect(shrineCell.shrineUsed).toBe(false);

        const overridden = cloneSessionCell(
            { row: 3, column: 3, tile: TileId.Base, object: ObjectId.Flag },
            { object: ObjectId.Start },
        );
        expect(overridden.object).toBe(ObjectId.Start);
    });
});

