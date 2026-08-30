import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router, convertToParamMap } from '@angular/router';
import { ConfigService } from '@app/services/config.service';
import { GameClientService } from '@app/services/game-client.service';
import { NotificationService } from '@app/services/notifications/notification.service';
import { SessionStorageClientService } from '@app/services/session-storage-client.service';
import { DoorState, Game, GridSize, Mode, ObjectId, ShrinePart, TileId } from '@common/game';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { EditGamePageComponent } from './edit-game-page.component';

const GRID_SIZE = 10;
const GRID_CELL_COUNT = 100;
const ERROR_MESSAGE = 'Erreur de sauvegarde';
const GAME_NAME_LIMIT = 40;
const GAME_DESCRIPTION_LIMIT = 150;
const SECOND_SHRINE_ROW = 4;
const SECOND_SHRINE_COLUMN = 4;

/**
 * Strategie :
 * - tester EditGamePageComponent comme page d'edition longue duree ou un brouillon
 *   local peut concurrencer les donnees reseau du jeu original
 * - verifier a la fois les garde-fous locaux de validation et la persistence
 *   du brouillon pour proteger le travail de l'utilisateur
 *
 * Cas limites cibles :
 * - un brouillon en session doit primer sur le fetch initial
 * - les limites exposees par ConfigService doivent rester accessibles depuis le template
 * - apres destruction du composant, une nouvelle emission de route ne doit plus
 *   provoquer de rechargement parasite
 */
describe('EditGamePageComponent', () => {
    let component: EditGamePageComponent;
    let fixture: ComponentFixture<EditGamePageComponent>;
    let gameClientServiceSpy: jasmine.SpyObj<GameClientService>;
    let sessionStorageSpy: jasmine.SpyObj<SessionStorageClientService>;
    let configServiceSpy: jasmine.SpyObj<ConfigService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
    let paramMapSubject: BehaviorSubject<ParamMap>;

    const mockGame: Game = {
        id: 'test-id',
        name: 'Test Game',
        size: GridSize.Small,
        lastModified: '2026-01-30',
        description: 'Test description',
        mode: Mode.Classic,
        isVisible: true,
        cells: [],
    };

    const createComponent = async () => {
        fixture = TestBed.createComponent(EditGamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    };

    const getCell = (row: number, column: number) => component.game.cells[column + component.game.size * row];

    beforeEach(async () => {
        paramMapSubject = new BehaviorSubject<ParamMap>(convertToParamMap({ id: 'test-id' }));
        gameClientServiceSpy = jasmine.createSpyObj('GameClientService', ['getGame', 'saveGame', 'extractErrors']);
        sessionStorageSpy = jasmine.createSpyObj('SessionStorageClientService', [
            'retrieveGameInSessionStorage',
            'saveGameInSessionStorage',
            'removeGameFromSessionStorage',
        ]);
        configServiceSpy = jasmine.createSpyObj('ConfigService', ['getToolDescription', 'getGameNameLimit', 'getGameDescriptionLimit']);
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        notificationServiceSpy = jasmine.createSpyObj('NotificationService', ['error', 'success']);

        gameClientServiceSpy.getGame.and.returnValue(of(mockGame));
        gameClientServiceSpy.saveGame.and.returnValue(of(void 0));
        gameClientServiceSpy.extractErrors.and.returnValue([ERROR_MESSAGE]);
        sessionStorageSpy.retrieveGameInSessionStorage.and.returnValue(undefined);
        configServiceSpy.getToolDescription.and.returnValue('description');
        configServiceSpy.getGameNameLimit.and.returnValue(GAME_NAME_LIMIT);
        configServiceSpy.getGameDescriptionLimit.and.returnValue(GAME_DESCRIPTION_LIMIT);

        await TestBed.configureTestingModule({
            imports: [EditGamePageComponent],
            providers: [
                { provide: GameClientService, useValue: gameClientServiceSpy },
                { provide: SessionStorageClientService, useValue: sessionStorageSpy },
                { provide: ConfigService, useValue: configServiceSpy },
                { provide: Router, useValue: routerSpy },
                { provide: NotificationService, useValue: notificationServiceSpy },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        paramMap: paramMapSubject.asObservable(),
                        snapshot: { queryParamMap: convertToParamMap({ mode: 'CLASSIC', size: '10' }) },
                    },
                },
            ],
        }).compileComponents();

        await createComponent();
    });

    afterEach(() => {
        fixture?.destroy();
        paramMapSubject.complete();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load the game from the service and apply query params on init', () => {
        expect(gameClientServiceSpy.getGame).toHaveBeenCalledWith('test-id');
        expect(component.game.name).toBe('Test Game');
        expect(component.game.description).toBe('Test description');
        expect(component.game.mode).toBe(Mode.Classic);
        expect(component.game.size).toBe(GRID_SIZE);
        expect(component.game.cells.length).toBe(GRID_CELL_COUNT);
    });

    it('should prefer the session draft over the fetched game when a draft exists', async () => {
        const draftGame: Game = { ...mockGame, name: 'Draft name', description: 'Draft description' };
        sessionStorageSpy.retrieveGameInSessionStorage.and.returnValue(draftGame);

        await createComponent();

        expect(component.game.name).toBe('Draft name');
        expect(component.game.description).toBe('Draft description');
    });

    [
        { name: '', description: 'Description', expected: false },
        { name: 'Nom', description: '', expected: false },
        { name: 'Nom', description: 'Description', expected: true },
    ].forEach(({ name, description, expected }) => {
        it(`should return ${expected} for canSaveInput when name="${name}" and description="${description}"`, () => {
            component.game.name = name;
            component.game.description = description;

            expect(component.canSaveInput).toBe(expected);
        });
    });

    it('should update the selected cell when painting a tile', () => {
        const cell = component.game.cells[0];
        component.activeTool = TileId.Wall;

        component.onCellClicked(cell);

        expect(component.selectedCell?.tile).toBe(TileId.Wall);
    });

    it('should place a closed door by default on a non-border cell', () => {
        const cell = component.game.cells[11];
        component.activeTool = TileId.Door;

        component.onCellClicked(cell);

        expect(component.selectedCell?.tile).toBe(TileId.Door);
        expect(component.selectedCell?.doorState).toBe(DoorState.Closed);
    });

    it('should toggle an existing door from closed to open when painted again', () => {
        const cell = component.game.cells[11];
        component.activeTool = TileId.Door;

        component.onCellClicked(cell);
        component.onCellClicked(cell);

        expect(component.selectedCell?.tile).toBe(TileId.Door);
        expect(component.selectedCell?.doorState).toBe(DoorState.Open);
    });

    it('should refuse to place a door on the border of the grid', () => {
        const borderCell = component.game.cells[0];
        component.activeTool = TileId.Door;

        component.onCellClicked(borderCell);

        expect(component.selectedCell?.tile).not.toBe(TileId.Door);
        expect(component.game.cells[0].tile).toBe(TileId.Base);
        expect(component.game.cells[0].doorState).toBeUndefined();
    });

    it('should clear the door state when replacing a door with a base tile', () => {
        const cell = component.game.cells[11];
        component.activeTool = TileId.Door;
        component.onCellClicked(cell);
        component.activeTool = TileId.Base;

        component.onCellClicked(cell);

        expect(component.selectedCell?.tile).toBe(TileId.Base);
        expect(component.selectedCell?.doorState).toBeUndefined();
    });

    it('should delete a door with right click and restore the base tile', () => {
        const cell = component.game.cells[11];
        component.activeTool = TileId.Door;
        component.onCellClicked(cell);

        component.onCellRightClicked({ cell, shiftKey: false });

        expect(component.selectedCell?.tile).toBe(TileId.Base);
        expect(component.selectedCell?.doorState).toBeUndefined();
        expect(component.game.cells[11].tile).toBe(TileId.Base);
        expect(component.game.cells[11].doorState).toBeUndefined();
    });

    it('should place a heal shrine on a free 2x2 terrain area', () => {
        component.activeTool = ObjectId.Heal;

        component.onCellClicked(getCell(1, 1));

        const topLeft = getCell(1, 1);
        const topRight = getCell(1, 2);
        const bottomLeft = getCell(2, 1);
        const bottomRight = getCell(2, 2);
        const shrineId = topLeft.shrineId;

        expect(shrineId).toBeDefined();
        expect(topLeft.object).toBe(ObjectId.Heal);
        expect(topRight.object).toBe(ObjectId.Heal);
        expect(bottomLeft.object).toBe(ObjectId.Heal);
        expect(bottomRight.object).toBe(ObjectId.Heal);
        expect(topLeft.shrinePart).toBe(ShrinePart.TopLeft);
        expect(topRight.shrinePart).toBe(ShrinePart.TopRight);
        expect(bottomLeft.shrinePart).toBe(ShrinePart.BottomLeft);
        expect(bottomRight.shrinePart).toBe(ShrinePart.BottomRight);
        expect(topRight.shrineId).toBe(shrineId);
        expect(bottomLeft.shrineId).toBe(shrineId);
        expect(bottomRight.shrineId).toBe(shrineId);
        expect(component.remainingMap[ObjectId.Heal]).toBe(0);
        expect(component.remainingMap[ObjectId.Combat]).toBe(0);
    });

    it('should refuse to place a shrine when the 2x2 area leaves the grid', () => {
        component.activeTool = ObjectId.Heal;

        component.onCellClicked(getCell(component.game.size - 1, component.game.size - 1));

        expect(getCell(component.game.size - 1, component.game.size - 1).object).toBeUndefined();
        expect(component.remainingMap[ObjectId.Heal]).toBe(1);
        expect(component.remainingMap[ObjectId.Combat]).toBe(1);
    });

    it('should refuse to place a shrine when one of the four cells is not free terrain', () => {
        const blockedCell = getCell(1, 2);
        component.game.cells[component.game.cells.indexOf(blockedCell)] = { ...blockedCell, tile: TileId.Wall };
        component.activeTool = ObjectId.Combat;

        component.onCellClicked(getCell(1, 1));

        expect(getCell(1, 1).object).toBeUndefined();
        expect(getCell(1, 2).object).toBeUndefined();
        expect(getCell(2, 1).object).toBeUndefined();
        expect(getCell(2, 2).object).toBeUndefined();
        expect(component.remainingMap[ObjectId.Heal]).toBe(1);
        expect(component.remainingMap[ObjectId.Combat]).toBe(1);
    });

    it('should enforce the shared shrine limit based on the map size', () => {
        component.activeTool = ObjectId.Heal;
        component.onCellClicked(getCell(1, 1));
        component.activeTool = ObjectId.Combat;

        component.onCellClicked(getCell(SECOND_SHRINE_ROW, SECOND_SHRINE_COLUMN));

        expect(getCell(SECOND_SHRINE_ROW, SECOND_SHRINE_COLUMN).object).toBeUndefined();
        expect(component.remainingMap[ObjectId.Heal]).toBe(0);
        expect(component.remainingMap[ObjectId.Combat]).toBe(0);
    });

    it('should preview a valid shrine placement while hovering', () => {
        component.activeTool = ObjectId.Heal;

        component.onGridCellHovered(getCell(1, 1));

        expect(component.shrinePlacementPreview).toEqual({
            cells: [
                { row: 1, column: 1 },
                { row: 1, column: 2 },
                { row: 2, column: 1 },
                { row: 2, column: 2 },
            ],
            isValid: true,
            imageSrc: 'assets/objects/health.png',
            topLeft: { row: 1, column: 1 },
        });
        expect(component.shrinePlacementMessage).toBe('Placement valide du sanctuaire 2x2.');
    });

    it('should preview an invalid shrine placement when one cell is blocked', () => {
        const blockedCell = getCell(1, 2);
        component.game.cells[component.game.cells.indexOf(blockedCell)] = { ...blockedCell, tile: TileId.Wall };
        component.activeTool = ObjectId.Combat;

        component.onGridCellHovered(getCell(1, 1));

        expect(component.shrinePlacementPreview?.isValid).toBeFalse();
        expect(component.shrinePlacementPreview?.imageSrc).toBe('assets/objects/combat.png');
        expect(component.shrinePlacementMessage).toBe('Les 4 cases doivent etre des tuiles de terrain libres.');
    });

    it('should keep a shrine when replacing one of its cells with another terrain tile', () => {
        component.activeTool = ObjectId.Heal;
        component.onCellClicked(getCell(1, 1));
        component.activeTool = TileId.Ice;

        component.onCellClicked(getCell(1, 1));

        expect(getCell(1, 1).tile).toBe(TileId.Ice);
        expect(getCell(1, 1).object).toBe(ObjectId.Heal);
        expect(getCell(1, 2).object).toBe(ObjectId.Heal);
        expect(getCell(2, 1).object).toBe(ObjectId.Heal);
        expect(getCell(2, 2).object).toBe(ObjectId.Heal);
        expect(getCell(1, 1).shrineId).toBeDefined();
        expect(getCell(1, 2).shrineId).toBe(getCell(1, 1).shrineId);
        expect(getCell(2, 1).shrineId).toBe(getCell(1, 1).shrineId);
        expect(getCell(2, 2).shrineId).toBe(getCell(1, 1).shrineId);
    });

    it('should delete all four cells of a shrine with shift + right click', () => {
        component.activeTool = ObjectId.Heal;
        component.onCellClicked(getCell(1, 1));

        component.onCellRightClicked({ cell: getCell(2, 2), shiftKey: true });

        expect(getCell(1, 1).object).toBeUndefined();
        expect(getCell(1, 2).object).toBeUndefined();
        expect(getCell(2, 1).object).toBeUndefined();
        expect(getCell(2, 2).object).toBeUndefined();
        expect(getCell(1, 1).shrineId).toBeUndefined();
        expect(getCell(1, 2).shrineId).toBeUndefined();
        expect(getCell(2, 1).shrineId).toBeUndefined();
        expect(getCell(2, 2).shrineId).toBeUndefined();
        expect(component.remainingMap[ObjectId.Heal]).toBe(1);
        expect(component.remainingMap[ObjectId.Combat]).toBe(1);
    });

    it('should save the current game on beforeunload when the page is not cancelling', () => {
        component.unloadNotification();

        expect(sessionStorageSpy.saveGameInSessionStorage).toHaveBeenCalledWith(component.game);
    });

    it('should not save the current game on beforeunload when cancelling', () => {
        component['isCancelling'] = true;

        component.unloadNotification();

        expect(sessionStorageSpy.saveGameInSessionStorage).not.toHaveBeenCalled();
    });

    it('should remove the draft and navigate back to admin on cancel', () => {
        component.onCancelClicked();

        expect(sessionStorageSpy.removeGameFromSessionStorage).toHaveBeenCalledWith('test-id');
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin-page'], { replaceUrl: true });
    });

    it('should report a local validation error when the game name is missing', () => {
        component.game.name = '';
        component.game.description = 'Description';

        component.onSaveButtonClicked();

        expect(component.errors).toContain('Le nom du jeu est requis.');
        expect(gameClientServiceSpy.saveGame).not.toHaveBeenCalled();
    });

    it('should report a local validation error when the description is missing', () => {
        component.game.name = 'Nom';
        component.game.description = '';

        component.onSaveButtonClicked();

        expect(component.errors).toContain('La description du jeu est requise.');
        expect(gameClientServiceSpy.saveGame).not.toHaveBeenCalled();
    });

    it('should save the game, clear the draft and navigate on successful save', () => {
        component.game.name = 'Nom';
        component.game.description = 'Description';

        component.onSaveButtonClicked();

        expect(gameClientServiceSpy.saveGame).toHaveBeenCalled();
        expect(sessionStorageSpy.removeGameFromSessionStorage).toHaveBeenCalledWith(component.game.id);
        expect(notificationServiceSpy.success).toHaveBeenCalled();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/admin-page'], { replaceUrl: true });
        expect(component.getIsSaving()).toBeFalse();
    });

    it('should expose extracted errors and reset the saving flag when save fails', () => {
        component.game.name = 'Nom';
        component.game.description = 'Description';
        gameClientServiceSpy.saveGame.and.returnValue(throwError(() => new Error('save failed')));

        component.onSaveButtonClicked();

        expect(gameClientServiceSpy.extractErrors).toHaveBeenCalled();
        expect(component.errors).toContain(ERROR_MESSAGE);
        expect(component.getIsSaving()).toBeFalse();
    });

    it('should stop reacting to route updates after ngOnDestroy', () => {
        component.ngOnDestroy();
        gameClientServiceSpy.getGame.calls.reset();

        paramMapSubject.next(convertToParamMap({ id: 'new-id' }));

        expect(gameClientServiceSpy.getGame).not.toHaveBeenCalled();
    });
});
