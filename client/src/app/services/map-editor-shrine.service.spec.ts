import { TestBed } from '@angular/core/testing';
import { GameGridCell } from '@app/interfaces/game';
import { GridSize, ObjectId, ShrinePart, TileId } from '@common/game';
import { MapEditorShrineService } from './map-editor-shrine.service';

/**
 * Strategie :
 * - tester MapEditorShrineService sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('MapEditorShrineService', () => {
    let service: MapEditorShrineService;

    const createGrid = (size: GridSize): GameGridCell[] => {
        const cells: GameGridCell[] = [];
        for (let row = 0; row < size; row++) {
            for (let column = 0; column < size; column++) {
                cells.push({ row, column, tile: TileId.Base });
            }
        }
        return cells;
    };

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(MapEditorShrineService);
    });

    it('should detect shrine tools', () => {
        expect(service.isShrineTool(ObjectId.Heal)).toBeTrue();
        expect(service.isShrineTool(ObjectId.Combat)).toBeTrue();
        expect(service.isShrineTool(TileId.Base)).toBeFalse();
    });

    it('should evaluate a valid 2x2 placement', () => {
        const grid = createGrid(GridSize.Small);

        const evaluation = service.evaluatePlacement(grid, GridSize.Small, { row: 1, column: 1 }, ObjectId.Heal, 1);

        expect(evaluation.isValid).toBeTrue();
        expect(evaluation.cells).toEqual([
            { row: 1, column: 1 },
            { row: 1, column: 2 },
            { row: 2, column: 1 },
            { row: 2, column: 2 },
        ]);
    });

    it('should reject a placement outside the grid', () => {
        const grid = createGrid(GridSize.Small);

        const evaluation = service.evaluatePlacement(grid, GridSize.Small, { row: 9, column: 9 }, ObjectId.Heal, 1);

        expect(evaluation.isValid).toBeFalse();
        expect(evaluation.reason).toContain('2x2');
    });

    it('should place and clear a shrine', () => {
        const grid = createGrid(GridSize.Small);
        const placed = service.placeShrine(
            grid,
            GridSize.Small,
            [
                { row: 1, column: 1 },
                { row: 1, column: 2 },
                { row: 2, column: 1 },
                { row: 2, column: 2 },
            ],
            ObjectId.Combat,
            'shrine-1',
        );

        expect(placed[11].object).toBe(ObjectId.Combat);
        expect(placed[11].shrinePart).toBe(ShrinePart.TopLeft);
        expect(placed[12].shrinePart).toBe(ShrinePart.TopRight);
        expect(placed[21].shrinePart).toBe(ShrinePart.BottomLeft);
        expect(placed[22].shrinePart).toBe(ShrinePart.BottomRight);

        const cleared = service.clearShrine(placed, 'shrine-1');
        expect(cleared[11].object).toBeUndefined();
        expect(cleared[11].shrineId).toBeUndefined();
        expect(cleared[22].shrinePart).toBeUndefined();
    });

    it('should compute remaining shrines based on grid size', () => {
        const grid = createGrid(GridSize.Small);
        const placed = service.placeShrine(
            grid,
            GridSize.Small,
            [
                { row: 1, column: 1 },
                { row: 1, column: 2 },
                { row: 2, column: 1 },
                { row: 2, column: 2 },
            ],
            ObjectId.Heal,
            'shrine-1',
        );

        expect(service.computeRemainingShrines(grid, GridSize.Small)).toBe(1);
        expect(service.computeRemainingShrines(placed, GridSize.Small)).toBe(0);
    });
});
