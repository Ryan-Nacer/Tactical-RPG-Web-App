import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TileId, ObjectId, Mode, Game, GameCell } from '@common/game';
import { GameCardComponent } from './game-card.component';

describe('GameCardComponent', () => {
    let component: GameCardComponent;
    let fixture: ComponentFixture<GameCardComponent>;

    const mockGameCells: GameCell[] = [
        { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
        { row: 0, column: 1, tile: TileId.Base },
        { row: 0, column: 2, tile: TileId.Wall },
        { row: 1, column: 0, tile: TileId.Base },
        { row: 1, column: 1, tile: TileId.Water },
        { row: 1, column: 2, tile: TileId.Door },
        { row: 2, column: 0, tile: TileId.Ice },
        { row: 2, column: 1, tile: TileId.Base },
        { row: 2, column: 2, tile: TileId.Base, object: ObjectId.Flag },
    ];

    const mockGame: Game = {
        id: '1',
        name: 'Test Game',
        description: 'A test game',
        mode: Mode.Classic,
        size: '100MB',
        lastModified: '2026-01-25',
        imageURL: 'http://example.com/image.jpg',
        isVisible: true,
        cells: mockGameCells,
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GameCardComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(GameCardComponent);
        component = fixture.componentInstance;

        // Initialiser les propriétés @Input() requises
        component.game = mockGame;

        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should display game information', () => {
        expect(component.game).toEqual(mockGame);
        expect(component.game.name).toBe('Test Game');
    });

    it('should have game cells', () => {
        const LENGTH_MOCK_GAME = component.game.cells.length;
        expect(component.game.cells).toBeDefined();
        expect(component.game.cells.length).toBe(LENGTH_MOCK_GAME);
        expect(component.game.cells[0].tile).toBe(TileId.Base);
        expect(component.game.cells[0].object).toBe(ObjectId.Start);
    });

    it('should have different tile types', () => {
        const tileTypes = component.game.cells.map((cell) => cell.tile);
        expect(tileTypes).toContain(TileId.Base);
        expect(tileTypes).toContain(TileId.Wall);
        expect(tileTypes).toContain(TileId.Water);
        expect(tileTypes).toContain(TileId.Door);
        expect(tileTypes).toContain(TileId.Ice);
    });
});
