import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';
import { GameClientService } from '@app/services/game-client.service';
import { GameSocketService } from '@app/services/game-socket.service';
import { Game, GridSize, Mode } from '@common/game';
import { of, Subject } from 'rxjs';
import { MatchCreationPageComponent } from './match-creation-page.component';

const EMPTY_COUNT = 0;
const FIRST_INDEX = 0;
const SECOND_INDEX = 1;
const CREATE_GAME_BUTTON_LABEL = 'Cr' + '\u00E9' + 'er une partie';
const EMPTY_STATE_MESSAGE = 'Aucun jeu visible disponible.';

/**
 * Strategie :
 * - tester MatchCreationPageComponent comme page Sprint 1 qui affiche les jeux
 *   visibles et se rafraichit via le socket d'administration
 * - verifier surtout le cycle de vie de la liste : chargement initial,
 *   rafraichissement et nettoyage de l'abonnement au destroy
 *
 * Cas limites cibles :
 * - une liste vide doit afficher l'etat vide plutot qu'un DOM incoherent
 * - un evenement socket doit recharger la liste avec les nouvelles donnees
 * - apres destruction du composant, un nouvel evenement socket ne doit plus
 *   relancer de chargement pour eviter un abonnement zombie
 * - une erreur reseau au chargement doit rester visible dans les tests, car la
 *   page ne sait pas la recuperer localement au Sprint 1
 */
describe('MatchCreationPageComponent', () => {
    let component: MatchCreationPageComponent;
    let fixture: ComponentFixture<MatchCreationPageComponent>;
    let gameClientServiceSpy: jasmine.SpyObj<GameClientService>;
    let gameListUpdated$: Subject<void>;

    const visibleGames: Game[] = [
        {
            id: '1',
            name: 'Test Game',
            description: 'A test game',
            mode: Mode.Classic,
            size: GridSize.Small,
            lastModified: '2026-01-25',
            imageURL: 'http://example.com/image.jpg',
            isVisible: true,
            cells: [],
        },
        {
            id: '3',
            name: 'Test Game3',
            description: 'Another test game',
            mode: Mode.CTF,
            size: GridSize.Medium,
            lastModified: '2026-01-26',
            imageURL: 'http://example.com/image3.jpg',
            isVisible: true,
            cells: [],
        },
    ];

    const destroyFixture = () => {
        if (fixture) {
            fixture.destroy();
        }
    };

    const createComponent = async () => {
        destroyFixture();
        fixture = TestBed.createComponent(MatchCreationPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    };

    beforeEach(async () => {
        gameListUpdated$ = new Subject<void>();
        gameClientServiceSpy = jasmine.createSpyObj('GameClientService', ['getVisibleGames']);
        gameClientServiceSpy.getVisibleGames.and.returnValue(of(visibleGames));

        await TestBed.configureTestingModule({
            imports: [MatchCreationPageComponent],
            providers: [
                provideRouter([]),
                { provide: GameClientService, useValue: gameClientServiceSpy },
                { provide: GameSocketService, useValue: { gameListUpdated$: gameListUpdated$.asObservable() } },
            ],
        }).compileComponents();

        await createComponent();
    });

    afterEach(() => {
        destroyFixture();
        gameListUpdated$.complete();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load visible games on init and render one card and button per game', () => {
        const gameCards = fixture.debugElement.queryAll(By.css('app-game-card'));
        const buttons = fixture.debugElement.queryAll(By.css('.create-game-button'));

        expect(gameClientServiceSpy.getVisibleGames).toHaveBeenCalledTimes(1);
        expect(component.visibleGames).toEqual(visibleGames);
        expect(gameCards.length).toBe(visibleGames.length);
        expect(buttons.length).toBe(visibleGames.length);
    });

    it('should expose the returned game data in order and configure button navigation', () => {
        const gameCards = fixture.debugElement.queryAll(By.css('app-game-card'));
        const buttons = fixture.debugElement.queryAll(By.directive(RouterLink));
        const firstButtonLink = buttons[FIRST_INDEX].injector.get(RouterLink);

        expect(gameCards[FIRST_INDEX].componentInstance.game.id).toBe(visibleGames[FIRST_INDEX].id);
        expect(gameCards[SECOND_INDEX].componentInstance.game.id).toBe(visibleGames[SECOND_INDEX].id);
        expect(buttons[FIRST_INDEX].nativeElement.textContent.trim()).toBe(CREATE_GAME_BUTTON_LABEL);
        expect(firstButtonLink.queryParams).toEqual({ gameId: '1', host: true, gridSize: GridSize.Small, gameName: 'Test Game', mode: Mode.Classic });
    });

    it('should render the empty state when no visible game is returned', async () => {
        gameClientServiceSpy.getVisibleGames.and.returnValue(of([]));

        await createComponent();

        const gameCards = fixture.debugElement.queryAll(By.css('app-game-card'));
        const emptyState = fixture.nativeElement.textContent;

        expect(component.visibleGames.length).toBe(EMPTY_COUNT);
        expect(gameCards.length).toBe(EMPTY_COUNT);
        expect(emptyState).toContain(EMPTY_STATE_MESSAGE);
    });

    it('should refresh the visible games when the socket emits an update', () => {
        const refreshedGames: Game[] = [{ ...visibleGames[0], id: '99', name: 'Refreshed Game' }];
        gameClientServiceSpy.getVisibleGames.and.returnValue(of(refreshedGames));

        gameListUpdated$.next();

        expect(gameClientServiceSpy.getVisibleGames).toHaveBeenCalledTimes(2);
        expect(component.visibleGames).toEqual(refreshedGames);
    });

    it('should stop reacting to socket updates after ngOnDestroy', () => {
        component.ngOnDestroy();
        gameClientServiceSpy.getVisibleGames.calls.reset();

        gameListUpdated$.next();

        expect(gameClientServiceSpy.getVisibleGames).not.toHaveBeenCalled();
    });
});
