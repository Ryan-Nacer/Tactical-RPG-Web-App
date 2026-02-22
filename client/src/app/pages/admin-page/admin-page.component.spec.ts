import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { GameClientService } from '@app/services/game-client.service';
import { GameSocketService } from '@app/services/game-socket.service';
import { Game } from '@common/game';
import { Subject, of, throwError } from 'rxjs';
import { AdminPageComponent } from './admin-page.component';

const HTTP_STATUS_NOT_FOUND = 404;
const GAME_ID_1 = '1';
const GAME_ID_2 = '2';
const GAME_SIZE = '10';
const GAME_DATE = '2026-01-25';

class MockGameSocketService {
    gameListUpdated$ = new Subject<void>();
}

@Component({ selector: 'app-game-card', standalone: true, template: '' })
class MockGameCardComponent {
    @Input() game!: Game;
}

type GameSetupData = { mode: string; size: string };

@Component({ selector: 'app-game-setup-form', standalone: true, template: '' })
class MockGameSetupFormComponent {
    @Output() formSubmitted = new EventEmitter<GameSetupData>();
}

describe('AdminPageComponent', () => {
    let fixture: ComponentFixture<AdminPageComponent>;
    let component: AdminPageComponent;

    let gameClientServiceSpy: jasmine.SpyObj<GameClientService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let gameSocketService: MockGameSocketService;

    const mockGames: Game[] = [
        { id: GAME_ID_1, name: 'G1', description: 'D1', mode: 'CLASSIC', size: GAME_SIZE, lastModified: GAME_DATE, isVisible: true, cells: [] },
        { id: GAME_ID_2, name: 'G2', description: 'D2', mode: 'CTF', size: GAME_SIZE, lastModified: GAME_DATE, isVisible: false, cells: [] },
    ] as Game[];

    const create = () => {
        fixture = TestBed.createComponent(AdminPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    };

    beforeEach(async () => {
        gameClientServiceSpy = jasmine.createSpyObj('GameClientService', ['getAllGames', 'deleteGame', 'updateGame']);
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);

        gameClientServiceSpy.getAllGames.and.returnValue(of([]));
        gameClientServiceSpy.deleteGame.and.returnValue(of({} as Game));
        gameClientServiceSpy.updateGame.and.returnValue(of(void 0));

        await TestBed.configureTestingModule({
            imports: [CommonModule, AdminPageComponent, MockGameCardComponent, MockGameSetupFormComponent],
            providers: [
                { provide: GameClientService, useValue: gameClientServiceSpy },
                { provide: GameSocketService, useClass: MockGameSocketService },
                { provide: Router, useValue: routerSpy },
            ],
        })
            .overrideComponent(AdminPageComponent, {
                set: { imports: [CommonModule, MockGameCardComponent, MockGameSetupFormComponent] },
            })
            .compileComponents();

        gameSocketService = TestBed.inject(GameSocketService) as unknown as MockGameSocketService;
    });

    it('should create', () => {
        create();
        expect(component).toBeTruthy();
    });

    it('loadGames success should call getAllGames', () => {
        gameClientServiceSpy.getAllGames.and.returnValue(of(mockGames));
        create();
        expect(gameClientServiceSpy.getAllGames).toHaveBeenCalledTimes(1);
    });

    it('loadGames success should set games', () => {
        gameClientServiceSpy.getAllGames.and.returnValue(of(mockGames));
        create();
        expect(component.games).toEqual(mockGames);
    });

    it('loadGames success should set isLoading to false', () => {
        gameClientServiceSpy.getAllGames.and.returnValue(of(mockGames));
        create();
        expect(component.isLoading).toBeFalse();
    });

    it('loadGames error should alert', () => {
        spyOn(window, 'alert');
        gameClientServiceSpy.getAllGames.and.returnValue(throwError(() => new Error('Network')));
        create();
        expect(window.alert).toHaveBeenCalledWith('Erreur lors du chargement des jeux');
    });

    it('loadGames error should set isLoading to false', () => {
        gameClientServiceSpy.getAllGames.and.returnValue(throwError(() => new Error('Network')));
        create();
        expect(component.isLoading).toBeFalse();
    });

    it('gameListUpdated$ emit should call getAllGames once', () => {
        gameClientServiceSpy.getAllGames.and.returnValue(of(mockGames));
        create();

        gameClientServiceSpy.getAllGames.calls.reset();

        gameSocketService.gameListUpdated$.next();

        expect(gameClientServiceSpy.getAllGames).toHaveBeenCalledTimes(1);
    });

    it('deleteGame should call deleteGame service with id', () => {
        create();
        component.games = [...mockGames];

        component.deleteGame(GAME_ID_1);

        expect(gameClientServiceSpy.deleteGame).toHaveBeenCalledWith(GAME_ID_1);
    });

    it('deleteGame success should remove game locally', () => {
        create();
        component.games = [...mockGames];

        component.deleteGame(GAME_ID_1);

        expect(component.games.map((g) => g.id)).toEqual([GAME_ID_2]);
    });

    it('deleteGame 404 should alert specific message', () => {
        spyOn(window, 'alert');
        gameClientServiceSpy.deleteGame.and.returnValue(throwError(() => ({ status: HTTP_STATUS_NOT_FOUND })));

        create();
        component.games = [{ ...mockGames[0] }];

        component.deleteGame(GAME_ID_1);

        expect(window.alert).toHaveBeenCalledWith('Ce jeu a déjà été supprimé.');
    });

    it('toggleVisibility should call updateGame with toggled isVisible', () => {
        create();
        const game = { ...mockGames[0], isVisible: true };

        component.toggleVisibility(game);

        expect(gameClientServiceSpy.updateGame).toHaveBeenCalledWith(GAME_ID_1, { isVisible: false });
    });

    it('toggleVisibility error should rollback isVisible', () => {
        gameClientServiceSpy.updateGame.and.returnValue(throwError(() => new Error('fail')));
        create();
        const game = { ...mockGames[0], isVisible: true };
        component.toggleVisibility(game);
        expect(game.isVisible).toBeTrue();
    });

    it('openCreateForm should set showCreateForm to true', () => {
        create();
        component.openCreateForm();
        expect(component.showCreateForm).toBeTrue();
    });

    it('closeCreateForm should set showCreateForm to false', () => {
        create();
        component.showCreateForm = true;
        component.closeCreateForm();
        expect(component.showCreateForm).toBeFalse();
    });
});
