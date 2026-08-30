import { CommonModule } from '@angular/common';
import { HttpStatusCode } from '@angular/common/http';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GameSetupData } from '@app/interfaces/game';
import { ERROR_MESSAGES } from '@app/pages/pages.constants';
import { GameClientService } from '@app/services/game-client.service';
import { GameSocketService } from '@app/services/game-socket.service';
import { NotificationService } from '@app/services/notifications/notification.service';
import { Game, GameCell, GridSize, Mode, ObjectId, TileId } from '@common/game';
import { Subject, of, throwError } from 'rxjs';
import { AdminPageComponent } from './admin-page.component';

const GAME_ID_1 = '1';
const GAME_ID_2 = '2';
const GAME_ID_3 = '3';
const FIRST_INDEX = 0;
const THIRD_INDEX = 2;

/**
 * Strategie :
 * - tester AdminPageComponent comme ecran d'administration qui doit rester coherent
 *   pendant les rafraichissements reseau et les evenements socket du Sprint 1
 * - couvrir les comportements observables qui changent vraiment l'experience:
 *   chargement, suppression, visibilite et navigation vers l'editeur
 *
 * Cas limites cibles :
 * - un echec reseau initial doit sortir l'ecran de l'etat de chargement
 * - deux rafraichissements qui se chevauchent ne doivent pas laisser une reponse
 *   obsolete ecraser la plus recente
 * - apres destruction du composant, les evenements socket ne doivent plus relancer
 *   de chargement pour eviter des abonnements zombies
 */
describe('AdminPageComponent', () => {
    let fixture: ComponentFixture<AdminPageComponent>;
    let component: AdminPageComponent;

    let gameClientServiceSpy: jasmine.SpyObj<GameClientService>;
    let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let gameListUpdatedSubject: Subject<void>;

    const mockGameCells: GameCell[] = [
        { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
        { row: 0, column: 1, tile: TileId.Base },
        { row: 0, column: 2, tile: TileId.Wall },
        { row: 1, column: 0, tile: TileId.Base },
        { row: 1, column: 1, tile: TileId.Water },
        { row: 1, column: 2, tile: TileId.Door },
        { row: 2, column: 0, tile: TileId.Ice },
        { row: 2, column: 1, tile: TileId.Base },
        { row: 2, column: 2, tile: TileId.Base, object: ObjectId.Start },
    ];

    const mockGames: Game[] = [
        {
            id: GAME_ID_1,
            name: 'Jeu test',
            description: 'Un jeu test',
            mode: Mode.Classic,
            size: GridSize.Medium,
            lastModified: '2026-01-25',
            imageURL: 'http://example.com/image.jpg',
            isVisible: true,
            cells: mockGameCells,
        },
        {
            id: GAME_ID_2,
            name: 'Jeu test2',
            description: 'Un jeu test',
            mode: Mode.CTF,
            size: GridSize.Medium,
            lastModified: '2026-01-25',
            imageURL: 'http://example.com/image.jpg',
            isVisible: false,
            cells: mockGameCells,
        },
    ];

    @Component({ selector: 'app-game-card', standalone: true, template: '' })
    class MockGameCardComponent {
        @Input() game!: Game;
    }

    @Component({ selector: 'app-game-setup-form', standalone: true, template: '' })
    class MockGameSetupFormComponent {
        @Output() formSubmitted = new EventEmitter<GameSetupData>();
    }

    const createComponent = () => {
        fixture = TestBed.createComponent(AdminPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    };

    beforeEach(async () => {
        gameClientServiceSpy = jasmine.createSpyObj('GameClientService', ['getAllGames', 'deleteGame', 'updateGame']);
        notificationServiceSpy = jasmine.createSpyObj('NotificationService', ['error', 'warning']);
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        gameListUpdatedSubject = new Subject<void>();

        gameClientServiceSpy.getAllGames.and.returnValue(of(mockGames));
        gameClientServiceSpy.deleteGame.and.returnValue(of({} as Game));
        gameClientServiceSpy.updateGame.and.returnValue(of(void 0));

        await TestBed.configureTestingModule({
            imports: [CommonModule, AdminPageComponent, MockGameCardComponent, MockGameSetupFormComponent, RouterLink],
            providers: [
                { provide: ActivatedRoute, useValue: {} },
                { provide: GameClientService, useValue: gameClientServiceSpy },
                { provide: GameSocketService, useValue: { gameListUpdated$: gameListUpdatedSubject.asObservable() } },
                { provide: NotificationService, useValue: notificationServiceSpy },
                { provide: Router, useValue: routerSpy },
            ],
        })
            .overrideComponent(AdminPageComponent, {
                set: { imports: [CommonModule, MockGameCardComponent, MockGameSetupFormComponent, RouterLink] },
            })
            .compileComponents();

        createComponent();
    });

    afterEach(() => {
        fixture?.destroy();
        gameListUpdatedSubject.complete();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load all games on init and stop the loading state', () => {
        expect(gameClientServiceSpy.getAllGames).toHaveBeenCalledTimes(1);
        expect(component.games).toEqual(mockGames);
        expect(component.isLoading).toBeFalse();
    });

    it('loadGames error should notify', fakeAsync(() => {
        gameClientServiceSpy.getAllGames.and.returnValue(throwError(() => new Error('Network')));

        fixture = TestBed.createComponent(AdminPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        tick();

        expect(component.isLoading).toBeFalse();
        expect(notificationServiceSpy.error).toHaveBeenCalledWith(ERROR_MESSAGES.loadGamesError);
    }));

    it('should reload games when the socket announces a list update', () => {
        gameClientServiceSpy.getAllGames.calls.reset();

        gameListUpdatedSubject.next();

        expect(gameClientServiceSpy.getAllGames).toHaveBeenCalledTimes(1);
    });

    it('should keep the latest game list when two socket refreshes overlap', () => {
        const firstReloadGames = new Subject<Game[]>();
        const secondReloadGames = new Subject<Game[]>();
        const newerGames = [{ ...mockGames[FIRST_INDEX], id: GAME_ID_3, name: 'Jeu le plus recent' }];

        gameClientServiceSpy.getAllGames.calls.reset();
        gameClientServiceSpy.getAllGames.and.returnValues(firstReloadGames, secondReloadGames);

        gameListUpdatedSubject.next();
        gameListUpdatedSubject.next();

        secondReloadGames.next(newerGames);
        secondReloadGames.complete();
        firstReloadGames.next([mockGames[FIRST_INDEX]]);
        firstReloadGames.complete();

        expect(gameClientServiceSpy.getAllGames).toHaveBeenCalledTimes(2);
        expect(component.games).toEqual(newerGames);
        expect(component.isLoading).toBeFalse();
    });

    it('should ignore socket updates after the component is destroyed', () => {
        component.ngOnDestroy();
        gameClientServiceSpy.getAllGames.calls.reset();

        gameListUpdatedSubject.next();

        expect(gameClientServiceSpy.getAllGames).not.toHaveBeenCalled();
    });

    it('should open the delete confirmation modal without deleting immediately', () => {
        component.games = [...mockGames];

        component.requestDeleteGame(mockGames[FIRST_INDEX]);

        expect(component.pendingDeletionGame).toEqual(mockGames[FIRST_INDEX]);
        expect(gameClientServiceSpy.deleteGame).not.toHaveBeenCalled();
    });

    it('should remove a game locally after a confirmed deletion', () => {
        component.games = [...mockGames];
        component.requestDeleteGame(mockGames[FIRST_INDEX]);

        component.confirmDeleteGame();

        expect(gameClientServiceSpy.deleteGame).toHaveBeenCalledWith(GAME_ID_1);
        expect(component.games.map((game) => game.id)).toEqual([GAME_ID_2]);
        expect(component.pendingDeletionGame).toBeNull();
    });

    it('should close the delete confirmation modal when cancellation is requested', () => {
        component.games = [...mockGames];
        component.requestDeleteGame(mockGames[FIRST_INDEX]);

        component.closeDeleteConfirmation();

        expect(gameClientServiceSpy.deleteGame).not.toHaveBeenCalled();
        expect(component.pendingDeletionGame).toBeNull();
        expect(component.games.map((game) => game.id)).toEqual([GAME_ID_1, GAME_ID_2]);
    });

    it('deleteGame 404 should notify with specific message', () => {
        gameClientServiceSpy.deleteGame.and.returnValue(throwError(() => ({ status: HttpStatusCode.NotFound })));
        component.games = [...mockGames];
        component.requestDeleteGame(mockGames[FIRST_INDEX]);

        component.confirmDeleteGame();

        expect(notificationServiceSpy.warning).toHaveBeenCalledWith(ERROR_MESSAGES.gameAlreadyDeleted);
        expect(component.games.map((game) => game.id)).toEqual([GAME_ID_2]);
        expect(component.pendingDeletionGame).toBeNull();
    });

    it('should notify and keep the game list intact when deletion fails for another reason', () => {
        gameClientServiceSpy.deleteGame.and.returnValue(throwError(() => new Error('boom')));
        component.games = [...mockGames];
        component.requestDeleteGame(mockGames[FIRST_INDEX]);

        component.confirmDeleteGame();

        expect(notificationServiceSpy.error).toHaveBeenCalledWith(ERROR_MESSAGES.deleteGameError);
        expect(component.games.map((game) => game.id)).toEqual([GAME_ID_1, GAME_ID_2]);
        expect(component.pendingDeletionGame).toEqual(mockGames[FIRST_INDEX]);
    });

    it('should toggle visibility through the service', () => {
        const game = { ...mockGames[FIRST_INDEX], isVisible: true };

        component.toggleVisibility(game);

        expect(gameClientServiceSpy.updateGame).toHaveBeenCalledWith(GAME_ID_1, { isVisible: false });
        expect(game.isVisible).toBeFalse();
    });

    it('should rollback visibility when the update fails', () => {
        gameClientServiceSpy.updateGame.and.returnValue(throwError(() => new Error('fail')));
        const game = { ...mockGames[FIRST_INDEX], isVisible: true };

        component.toggleVisibility(game);

        expect(game.isVisible).toBeTrue();
        expect(notificationServiceSpy.error).toHaveBeenCalledWith(ERROR_MESSAGES.toggleVisibilityError);
    });

    it('should open and close the creation form', () => {
        component.openCreateForm();
        expect(component.showCreateForm).toBeTrue();

        component.closeCreateForm();
        expect(component.showCreateForm).toBeFalse();
    });

    it('should navigate to the edit page with the submitted setup data', () => {
        const gameSetupData: GameSetupData = { mode: Mode.CTF, size: GridSize.Large };
        component.showCreateForm = true;

        component.onFormSubmitted(gameSetupData);

        expect(component.showCreateForm).toBeFalse();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/edit-game-page'], {
            queryParams: { mode: Mode.CTF, size: GridSize.Large },
            replaceUrl: true,
        });
    });

    it('should render the administration titles and one game card per loaded game', () => {
        const sectionTitle = fixture.nativeElement.querySelector('.games-section-title');
        const gameCards = fixture.debugElement.queryAll(By.css('.game'));

        expect(sectionTitle?.textContent).toContain('Jeux offerts');
        expect(gameCards.length).toBe(mockGames.length);
    });

    it('should render the create button and the visibility label for a visible game', () => {
        const buttons = fixture.debugElement.queryAll(By.css('button'));
        const visibilityButton = fixture.debugElement.queryAll(By.css('.game-actions button'))[THIRD_INDEX];

        expect(buttons[FIRST_INDEX]?.nativeElement.textContent.trim()).toBe('Créer un nouveau jeu');
        expect(visibilityButton?.nativeElement.textContent.trim()).toBe('Rendre le jeu invisible');
    });
});
