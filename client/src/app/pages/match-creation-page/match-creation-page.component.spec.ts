import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { GameClientService } from '@app/services/game-client.service';
import { GameSocketService } from '@app/services/game-socket.service';
import { TileId, ObjectId, Mode, Game, GameCell } from '@common/game';
import { of, Subject } from 'rxjs';
import { MatchCreationPageComponent } from './match-creation-page.component';

describe('MatchCreationPageComponent', () => {
    let component: MatchCreationPageComponent;
    let fixture: ComponentFixture<MatchCreationPageComponent>;
    let mockGameClientService: jasmine.SpyObj<GameClientService>;
    let gameListUpdated$: Subject<unknown>;

    const EXPECTED_VISIBLE_GAMES_COUNT = 2;
    const EMPTY_ARRAY_LENGTH = 0;
    const FIRST_GAME_INDEX = 0;
    const SECOND_GAME_INDEX = 1;

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

    const mockGames: Game[] = [
        {
            id: '1',
            name: 'Test Game',
            description: 'A test game',
            mode: Mode.Classic,
            size: '100MB',
            lastModified: '2026-01-25',
            imageURL: 'http://example.com/image.jpg',
            isVisible: true,
            cells: mockGameCells,
        },
        {
            id: '2',
            name: 'Test Game2',
            description: 'A test game',
            mode: Mode.CTF,
            size: '100MB',
            lastModified: '2026-01-25',
            imageURL: 'http://example.com/image.jpg',
            isVisible: false,
            cells: mockGameCells,
        },
        {
            id: '3',
            name: 'Test Game3',
            description: 'Another test game',
            mode: Mode.Classic,
            size: '150MB',
            lastModified: '2026-01-26',
            imageURL: 'http://example.com/image3.jpg',
            isVisible: true,
            cells: mockGameCells,
        },
    ];

    beforeEach(async () => {
        const gameClientServiceSpy = jasmine.createSpyObj('GameClientService', ['getVisibleGames']);
        const visibleGames = mockGames.filter((game) => game.isVisible === true);
        gameClientServiceSpy.getVisibleGames.and.returnValue(of(visibleGames));
        gameListUpdated$ = new Subject();

        await TestBed.configureTestingModule({
            imports: [MatchCreationPageComponent],
            providers: [
                provideRouter([]),
                { provide: GameClientService, useValue: gameClientServiceSpy },
                { provide: GameSocketService, useValue: { gameListUpdated$: gameListUpdated$.asObservable() } },
            ],
        }).compileComponents();

        mockGameClientService = TestBed.inject(GameClientService) as jasmine.SpyObj<GameClientService>;
        fixture = TestBed.createComponent(MatchCreationPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('getAllVisibleGames', () => {
        it('should call gameClientService.getVisibleGames on initialization', () => {
            expect(mockGameClientService.getVisibleGames).toHaveBeenCalled();
        });

        it('should filter and store only visible games', () => {
            const visibleGames = mockGames.filter((game) => game.isVisible === true);
            expect(component.visibleGames.length).toBe(EXPECTED_VISIBLE_GAMES_COUNT);
            expect(component.visibleGames).toEqual(visibleGames);
        });

        it('should exclude games with visible set to false', () => {
            const invisibleGame = component.visibleGames.find((game) => game.id === '2');
            expect(invisibleGame).toBeUndefined();
        });

        it('should include all games with visible set to true', () => {
            const visibleGameIds = component.visibleGames.map((game) => game.id);
            expect(visibleGameIds).toContain(mockGames[0].id);
            expect(visibleGameIds).toContain(mockGames[2].id);
        });
    });

    describe('Template rendering', () => {
        it('should render game cards for each visible game', () => {
            const gameCards = fixture.debugElement.queryAll(By.css('app-game-card'));
            expect(gameCards.length).toBe(EXPECTED_VISIBLE_GAMES_COUNT);
        });

        it('should render buttons for each visible game', () => {
            const buttons = fixture.debugElement.queryAll(By.css('button'));
            expect(buttons.length).toBe(EXPECTED_VISIBLE_GAMES_COUNT);
        });

        it('should display button text "Créer une partie"', () => {
            const buttons = fixture.debugElement.queryAll(By.css('button'));
            buttons.forEach((button) => {
                expect(button.nativeElement.textContent.trim()).toBe('Créer une partie');
            });
        });

        it('should pass correct game data to game-card components', () => {
            const gameCards = fixture.debugElement.queryAll(By.css('app-game-card'));
            expect(gameCards[FIRST_GAME_INDEX].componentInstance.game.id).toBe('1');
            expect(gameCards[SECOND_GAME_INDEX].componentInstance.game.id).toBe('3');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty games array', () => {
            mockGameClientService.getVisibleGames.and.returnValue(of([]));
            fixture = TestBed.createComponent(MatchCreationPageComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();

            expect(component.visibleGames.length).toBe(EMPTY_ARRAY_LENGTH);
            const gameCards = fixture.debugElement.queryAll(By.css('app-game-card'));
            expect(gameCards.length).toBe(EMPTY_ARRAY_LENGTH);
        });

        it('should handle all games being invisible', () => {
            const invisibleGames: Game[] = [];
            mockGameClientService.getVisibleGames.and.returnValue(of(invisibleGames));
            fixture = TestBed.createComponent(MatchCreationPageComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();

            expect(component.visibleGames.length).toBe(EMPTY_ARRAY_LENGTH);
        });

        it('should handle all games being visible', () => {
            const allVisibleGames = mockGames.map((game) => ({ ...game, isVisible: true }));
            mockGameClientService.getVisibleGames.and.returnValue(of(allVisibleGames));
            fixture = TestBed.createComponent(MatchCreationPageComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();

            expect(component.visibleGames.length).toBe(mockGames.length);
        });

        it('should handle single visible game', () => {
            const singleGameArray = [mockGames[0]];
            mockGameClientService.getVisibleGames.and.returnValue(of(singleGameArray));
            fixture = TestBed.createComponent(MatchCreationPageComponent);
            component = fixture.componentInstance;
            fixture.detectChanges();

            expect(component.visibleGames.length).toBe(1);
            expect(component.visibleGames[0].id).toBe(mockGames[0].id);
        });
    });

    describe('Component initialization', () => {
        it('should call getAllVisibleGames in constructor', () => {
            spyOn(MatchCreationPageComponent.prototype, 'getAllVisibleGames');

            TestBed.createComponent(MatchCreationPageComponent);

            expect(MatchCreationPageComponent.prototype.getAllVisibleGames).toHaveBeenCalled();
        });
    });

    describe('Game data integrity', () => {
        it('should preserve game properties after filtering', () => {
            const firstVisibleGame = component.visibleGames[FIRST_GAME_INDEX];

            expect(firstVisibleGame.name).toBe('Test Game');
            expect(firstVisibleGame.description).toBe('A test game');
            expect(firstVisibleGame.mode).toBe(Mode.Classic);
            expect(firstVisibleGame.size).toBe('100MB');
            expect(firstVisibleGame.cells).toEqual(mockGameCells);
        });

        it('should maintain original game order for visible games', () => {
            expect(component.visibleGames[FIRST_GAME_INDEX].id).toBe('1');
            expect(component.visibleGames[SECOND_GAME_INDEX].id).toBe('3');
        });

        it('should not modify original games array', () => {
            const originalGamesCount = mockGames.length;
            component.getAllVisibleGames();

            expect(mockGames.length).toBe(originalGamesCount);
        });
    });
});
