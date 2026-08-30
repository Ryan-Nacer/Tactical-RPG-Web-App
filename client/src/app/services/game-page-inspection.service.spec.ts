import { TestBed } from '@angular/core/testing';
import { ObjectId, TileId } from '@common/game';
import { GamePageInspectionService } from './game-page-inspection.service';

/**
 * Strategie :
 * - tester le service d'inspection comme couche de presentation derivee pour la page de jeu
 * - verifier les descriptions de tuiles/objets et le positionnement du panneau d'inspection
 *
 * Cas limites cibles :
 * - clic proche du bord de la fenetre
 * - identifiants de tuile et d'objet connus ou absents
 */
describe('GamePageInspectionService', () => {
    let service: GamePageInspectionService;
    const VIEWPORT_WIDTH = 300;
    const VIEWPORT_HEIGHT = 220;
    const CLICK_X = 290;
    const CLICK_Y = 210;
    const MIN_PADDING = 12;
    const EXPECTED_MAX_LEFT = 48;
    const EXPECTED_MAX_TOP = 20;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(GamePageInspectionService);
    });

    it('returns tile description for known tile', () => {
        const result = service.describeTile(TileId.Water);

        expect(result.label).toBe('Eau');
        expect(result.cost).toBe('2');
    });

    it('returns default tile description when tile is undefined', () => {
        const result = service.describeTile(undefined);

        expect(result.label).toBe('Terrain de base');
    });

    it('returns object label and effect for a known object', () => {
        expect(service.getObjectLabel(ObjectId.Start)).toBe('Point de depart');
        expect(service.getObjectEffect(ObjectId.Start)).toContain('Case reservee');
    });

    it('returns fallback object details when object is undefined', () => {
        expect(service.getObjectLabel(undefined)).toBe('Aucun objet');
        expect(service.getObjectEffect(undefined)).toBe('Aucun effet additionnel sur cette case.');
    });

    it('detects inspection popover visibility from selected cell state', () => {
        expect(service.hasInspectionPopover(null)).toBeFalse();
        expect(service.hasInspectionPopover({ row: 1, column: 2 })).toBeTrue();
    });

    it('computes a bounded popover position inside viewport', () => {
        spyOnProperty(window, 'innerWidth', 'get').and.returnValue(VIEWPORT_WIDTH);
        spyOnProperty(window, 'innerHeight', 'get').and.returnValue(VIEWPORT_HEIGHT);

        const position = service.getInspectionPopoverPosition(CLICK_X, CLICK_Y);

        expect(position.left).toBeGreaterThanOrEqual(MIN_PADDING);
        expect(position.top).toBeGreaterThanOrEqual(MIN_PADDING);
        expect(position.left).toBeLessThanOrEqual(EXPECTED_MAX_LEFT);
        expect(position.top).toBeLessThanOrEqual(EXPECTED_MAX_TOP);
    });
});
