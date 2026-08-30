import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { DoorState, ObjectId, ShrinePart, TileId } from '@common/game';
import { GameGridComponent } from './game-grid.component';
import { GameGridCell } from '@app/interfaces/game';

const SHRINE_PREVIEW_CELL_COUNT = 4;

/**
 * Strategie :
 * - tester GameGridComponent comme surface d'interaction reutilisee par plusieurs vues
 * - verifier les entrees/sorties, les interactions souris-clavier et les aides
 *   d'affichage rendues dans le template
 *
 * Cas limites cibles :
 * - boutons de souris non supportes
 * - glisser gauche desactive mais glisser droit encore autorise
 * - etiquette de secours quand le nom ou l'avatar d'un joueur sont absents
 *
 * Ces cas sont utiles parce que ce composant concentre beaucoup d'interactions UI
 * qui doivent rester stables lorsqu'il est integre dans les pages d'edition et de jeu.
 */

describe('GameGridComponent', () => {
    let component: GameGridComponent;
    let fixture: ComponentFixture<GameGridComponent>;

    const GRID_SIZE = 10;
    const GRID_SIZE_ZERO = 0;
    const LEFT_BUTTON = 0;
    const RIGHT_BUTTON = 2;
    const FIRST_ROW = 0;
    const FIRST_COL = 0;
    const SECOND_ROW = 1;
    const SECOND_COL = 1;

    const mockCell: GameGridCell = {
        row: FIRST_ROW,
        column: FIRST_COL,
        tile: TileId.Base,
    };

    const mockCellWithObject: GameGridCell = {
        row: SECOND_ROW,
        column: SECOND_COL,
        tile: TileId.Base,
        object: ObjectId.Start,
    };

    const mockCells: GameGridCell[] = [mockCell, mockCellWithObject];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GameGridComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(GameGridComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    describe('Input properties', () => {
        it('should have default gridSize of 0', () => {
            expect(component.gridSize).toBe(GRID_SIZE_ZERO);
        });

        it('should accept gridSize input', () => {
            component.gridSize = GRID_SIZE;
            expect(component.gridSize).toBe(GRID_SIZE);
        });

        it('should have default empty cells array', () => {
            expect(component.cells).toEqual([]);
        });

        it('should accept cells input', () => {
            component.cells = mockCells;
            expect(component.cells).toEqual(mockCells);
        });

        it('should have default selectedCell as null', () => {
            expect(component.selectedCell).toBeNull();
        });

        it('should accept selectedCell input', () => {
            component.selectedCell = mockCell;
            expect(component.selectedCell).toEqual(mockCell);
        });

        it('should have default allowLeftDrag as true', () => {
            expect(component.allowLeftDrag).toBe(true);
        });

        it('should accept allowLeftDrag input', () => {
            component.allowLeftDrag = false;
            expect(component.allowLeftDrag).toBe(false);
        });
    });

    describe('Output events', () => {
        it('should emit cellClicked on left mouse button down', () => {
            spyOn(component.cellClicked, 'emit');
            fixture.detectChanges();

            const event = new MouseEvent('mousedown', { button: LEFT_BUTTON });
            component.onCellMouseDown(event, mockCell);

            expect(component.cellClicked.emit).toHaveBeenCalledWith(mockCell);
        });

        it('should emit cellRightClicked on right mouse button down', () => {
            spyOn(component.cellRightClicked, 'emit');
            fixture.detectChanges();

            const event = new MouseEvent('mousedown', { button: RIGHT_BUTTON, clientX: 50, clientY: 60 });
            component.onCellMouseDown(event, mockCell);

            expect(component.cellRightClicked.emit).toHaveBeenCalledWith({ cell: mockCell, shiftKey: false, clientX: 50, clientY: 60 });
        });

        it('should not emit on invalid button', () => {
            spyOn(component.cellClicked, 'emit');
            spyOn(component.cellRightClicked, 'emit');
            fixture.detectChanges();

            const event = new MouseEvent('mousedown', { button: 1 });
            component.onCellMouseDown(event, mockCell);

            expect(component.cellClicked.emit).not.toHaveBeenCalled();
            expect(component.cellRightClicked.emit).not.toHaveBeenCalled();
        });

        it('should emit hovered cell on mouse enter and null on grid leave', () => {
            spyOn(component.cellHovered, 'emit');

            component.onCellMouseEnter(mockCell);
            component.onGridMouseLeave();

            expect(component.cellHovered.emit).toHaveBeenCalledWith(mockCell);
            expect(component.cellHovered.emit).toHaveBeenCalledWith(null);
        });
    });

    describe('Mouse events', () => {
        it('should stop painting on grid mouse leave', () => {
            fixture.detectChanges();
            component.onGridMouseLeave();

            component.onCellMouseEnter(mockCell);

            spyOn(component.cellClicked, 'emit');
            component.onCellMouseEnter(mockCell);
            expect(component.cellClicked.emit).not.toHaveBeenCalled();
        });

        it('should handle cell mouse enter with left drag allowed', () => {
            const spy = spyOn(component.cellClicked, 'emit');
            fixture.detectChanges();

            const downEvent = new MouseEvent('mousedown', { button: LEFT_BUTTON });
            component.onCellMouseDown(downEvent, mockCell);
            spy.calls.reset();

            component.onCellMouseEnter(mockCellWithObject);

            expect(component.cellClicked.emit).toHaveBeenCalledWith(mockCellWithObject);
        });

        it('should not emit on cell mouse enter when left drag is disabled', () => {
            component.allowLeftDrag = false;
            const spy = spyOn(component.cellClicked, 'emit');
            fixture.detectChanges();

            const downEvent = new MouseEvent('mousedown', { button: LEFT_BUTTON });
            component.onCellMouseDown(downEvent, mockCell);
            spy.calls.reset();

            component.onCellMouseEnter(mockCellWithObject);

            expect(component.cellClicked.emit).not.toHaveBeenCalled();
        });

        it('should allow right drag regardless of allowLeftDrag setting', () => {
            component.allowLeftDrag = false;
            const spy = spyOn(component.cellRightClicked, 'emit');
            fixture.detectChanges();

            const downEvent = new MouseEvent('mousedown', { button: RIGHT_BUTTON });
            component.onCellMouseDown(downEvent, mockCell);
            spy.calls.reset();

            component.onCellMouseEnter(mockCellWithObject);

            expect(component.cellRightClicked.emit).toHaveBeenCalledWith({ cell: mockCellWithObject, shiftKey: false, clientX: 0, clientY: 0 });
        });

        it('should prevent default on right click', () => {
            fixture.detectChanges();
            const event = new MouseEvent('contextmenu');
            spyOn(event, 'preventDefault');

            component.onCellRightClick(event);

            expect(event.preventDefault).toHaveBeenCalled();
        });
    });

    describe('Keyboard events', () => {
        it('should track shift key down', () => {
            fixture.detectChanges();
            spyOn(component.cellRightClicked, 'emit');

            const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
            component.onKeyDown(shiftDownEvent);

            const mouseDownEvent = new MouseEvent('mousedown', { button: RIGHT_BUTTON });
            component.onCellMouseDown(mouseDownEvent, mockCell);

            expect(component.cellRightClicked.emit).toHaveBeenCalledWith({ cell: mockCell, shiftKey: true, clientX: 0, clientY: 0 });
        });

        it('should track shift key up', () => {
            fixture.detectChanges();

            const shiftDownEvent = new KeyboardEvent('keydown', { key: 'Shift' });
            component.onKeyDown(shiftDownEvent);

            const shiftUpEvent = new KeyboardEvent('keyup', { key: 'Shift' });
            component.onKeyUp(shiftUpEvent);

            spyOn(component.cellRightClicked, 'emit');
            const mouseDownEvent = new MouseEvent('mousedown', { button: RIGHT_BUTTON });
            component.onCellMouseDown(mouseDownEvent, mockCell);

            expect(component.cellRightClicked.emit).toHaveBeenCalledWith({ cell: mockCell, shiftKey: false, clientX: 0, clientY: 0 });
        });

        it('should ignore non-shift key events', () => {
            fixture.detectChanges();

            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            component.onKeyDown(enterEvent);

            spyOn(component.cellRightClicked, 'emit');
            const mouseDownEvent = new MouseEvent('mousedown', { button: RIGHT_BUTTON });
            component.onCellMouseDown(mouseDownEvent, mockCell);

            expect(component.cellRightClicked.emit).toHaveBeenCalledWith({ cell: mockCell, shiftKey: false, clientX: 0, clientY: 0 });
        });
    });

    describe('Selection', () => {
        it('should return true for isSelected when cell matches selectedCell', () => {
            component.selectedCell = mockCell;
            const result = component.isSelected(mockCell);
            expect(result).toBe(true);
        });

        it('should return false for isSelected when cell does not match selectedCell', () => {
            component.selectedCell = mockCell;
            const result = component.isSelected(mockCellWithObject);
            expect(result).toBe(false);
        });

        it('should return false for isSelected when no cell is selected', () => {
            component.selectedCell = null;
            const result = component.isSelected(mockCell);
            expect(result).toBe(false);
        });

        it('should return true for isActionTarget when cell is in actionTargetCells', () => {
            component.actionTargetCells = [{ row: FIRST_ROW, column: FIRST_COL }];

            const result = component.isActionTarget(mockCell);

            expect(result).toBe(true);
        });

        it('should detect an open door cell', () => {
            const result = component.isDoorOpen({ ...mockCell, tile: TileId.Door, doorState: DoorState.Open });

            expect(result).toBe(true);
        });

        it('should detect a closed door cell when no open state is present', () => {
            const result = component.isDoorClosed({ ...mockCell, tile: TileId.Door, doorState: DoorState.Closed });

            expect(result).toBe(true);
        });

        it('should render the open door class on an open door cell', () => {
            component.gridSize = 1;
            component.cells = [{ row: 0, column: 0, tile: TileId.Door, doorState: DoorState.Open }];

            fixture.detectChanges();

            const cell = fixture.debugElement.query(By.css('.game-grid-cell'));
            expect(cell.nativeElement.classList.contains('door-open')).toBeTrue();
            expect(cell.nativeElement.classList.contains('door-closed')).toBeFalse();
        });

        it('should render the closed door class on a closed door cell', () => {
            component.gridSize = 1;
            component.cells = [{ row: 0, column: 0, tile: TileId.Door, doorState: DoorState.Closed }];

            fixture.detectChanges();

            const cell = fixture.debugElement.query(By.css('.game-grid-cell'));
            expect(cell.nativeElement.classList.contains('door-closed')).toBeTrue();
            expect(cell.nativeElement.classList.contains('door-open')).toBeFalse();
        });

        it('should render a single 2x2 shrine image from the top-left cell only', () => {
            component.gridSize = 2;
            component.cells = [
                { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Heal, shrineId: 's1', shrinePart: ShrinePart.TopLeft },
                { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Heal, shrineId: 's1', shrinePart: ShrinePart.TopRight },
                { row: 1, column: 0, tile: TileId.Base, object: ObjectId.Heal, shrineId: 's1', shrinePart: ShrinePart.BottomLeft },
                { row: 1, column: 1, tile: TileId.Base, object: ObjectId.Heal, shrineId: 's1', shrinePart: ShrinePart.BottomRight },
            ];

            fixture.detectChanges();

            const images = fixture.debugElement.queryAll(By.css('.cellObjectImage.shrine-image'));
            const fallbackSpans = fixture.debugElement.queryAll(By.css('.cellObject.obj-heal'));
            expect(images.length).toBe(1);
            expect(fallbackSpans.length).toBe(0);
            expect(images[0].nativeElement.getAttribute('src')).toBe('assets/objects/health.png');
        });

        it('should render valid placement preview classes and ghost image', () => {
            component.gridSize = 2;
            component.cells = [
                { row: 0, column: 0, tile: TileId.Base },
                { row: 0, column: 1, tile: TileId.Base },
                { row: 1, column: 0, tile: TileId.Base },
                { row: 1, column: 1, tile: TileId.Base },
            ];
            component.placementPreview = {
                cells: [
                    { row: 0, column: 0 },
                    { row: 0, column: 1 },
                    { row: 1, column: 0 },
                    { row: 1, column: 1 },
                ],
                isValid: true,
                imageSrc: 'assets/objects/health.png',
                topLeft: { row: 0, column: 0 },
            };

            fixture.detectChanges();

            const previewCells = fixture.debugElement.queryAll(By.css('.game-grid-cell.is-placement-preview-valid'));
            const previewImages = fixture.debugElement.queryAll(By.css('.placement-preview-image'));
            expect(previewCells.length).toBe(SHRINE_PREVIEW_CELL_COUNT);
            expect(previewImages.length).toBe(1);
            expect(previewImages[0].nativeElement.getAttribute('src')).toBe('assets/objects/health.png');
        });
    });

    describe('Grid template', () => {
        it('should generate correct grid template', () => {
            component.gridSize = GRID_SIZE;
            const template = component.gridTemplate;
            expect(template).toBe(`repeat(${GRID_SIZE}, 1fr)`);
        });

        it('should generate grid template with size 1', () => {
            component.gridSize = 1;
            const template = component.gridTemplate;
            expect(template).toBe('repeat(1, 1fr)');
        });
    });

    describe('Player marker labels', () => {
        it('should return the first letter of the player name', () => {
            component.players = [
                { id: 'p1', name: 'Raquelle', row: 0, column: 0 },
                { id: 'p2', name: 'Ryan', row: 0, column: 0 },
            ];

            const firstLabel = component.getPlayerMarkerLabel(component.players[0]);
            const secondLabel = component.getPlayerMarkerLabel(component.players[1]);

            expect(firstLabel).toBe('R');
            expect(secondLabel).toBe('R');
        });

        it('should fallback to P when name is empty', () => {
            component.players = [{ id: 'p1', name: '   ', row: 0, column: 0 }];

            const firstLabel = component.getPlayerMarkerLabel(component.players[0]);

            expect(firstLabel).toBe('P');
        });

        it('should render avatar image when player has avatarImageUrl', () => {
            component.gridSize = 1;
            component.cells = [{ row: 0, column: 0, tile: TileId.Base }];
            component.players = [{ id: 'p1', name: 'Ryan', row: 0, column: 0, avatarImageUrl: '/assets/avatar-ryan.png' }];

            fixture.detectChanges();

            const avatar = fixture.debugElement.query(By.css('.cellPlayer-avatar'));
            const fallback = fixture.debugElement.query(By.css('.cellPlayer-label'));

            expect(avatar).toBeTruthy();
            expect(avatar.nativeElement.getAttribute('src')).toBe('/assets/avatar-ryan.png');
            expect(fallback).toBeNull();
        });

        it('should render text fallback when avatarImageUrl is missing', () => {
            component.gridSize = 1;
            component.cells = [{ row: 0, column: 0, tile: TileId.Base }];
            component.players = [{ id: 'p1', name: 'Raquelle', row: 0, column: 0 }];

            fixture.detectChanges();

            const avatar = fixture.debugElement.query(By.css('.cellPlayer-avatar'));
            const fallback = fixture.debugElement.query(By.css('.cellPlayer-label'));

            expect(avatar).toBeNull();
            expect(fallback).toBeTruthy();
            expect(fallback.nativeElement.textContent.trim()).toBe('R');
        });
    });

    describe('Object descriptions', () => {
        it('should return start point description', () => {
            const description = component.getObjectDescription('start');
            expect(description).toContain('Point de départ');
        });

        it('should return flag description', () => {
            const description = component.getObjectDescription('flag');
            expect(description).toContain('Drapeau');
        });

        it('should return heal sanctuary description', () => {
            const description = component.getObjectDescription('heal');
            expect(description).toContain('Sanctuaire de soin');
            expect(description).toContain('2 HP');
        });

        it('should return combat sanctuary description', () => {
            const description = component.getObjectDescription('combat');
            expect(description).toContain('Sanctuaire de combat');
            expect(description).toContain('attaque et défense');
        });

        it('should return empty string for unknown object', () => {
            const description = component.getObjectDescription('unknown');
            expect(description).toBe('');
        });

        it('should return empty string for undefined object', () => {
            const description = component.getObjectDescription(undefined);
            expect(description).toBe('');
        });
    });
});
