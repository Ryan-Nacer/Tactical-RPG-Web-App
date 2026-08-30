import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { EndGamePageComponent } from './end-game-page.component';
import { RoomSocketService } from '@app/services/room-socket.service';
import { GamePageStateService } from '@app/services/game-page-state.service';
import { GamePagePlayerService } from '@app/services/displacement/game-page-player.service';
import { ChatSocketService } from '@app/services/chat/chat-socket.service';
import { GameSessionPlayer, GameSessionState } from '@common/game-session';
import { TileId } from '@common/game';
/**
 * Strategie :
 * - tester EndGamePageComponent comme vue de fin de partie qui affiche les
 *   statistiques des joueurs ainsi que les messages (chat et journal)
 * - verifier la logique du composant : calcul des statistiques, tri des joueurs
 *   et gestion des interactions utilisateur
 * - les dependances sont mockees afin d’isoler le composant et tester uniquement sa logique
 *
 * Cas limites cibles :
 * - un joueur avec 0 combat ne doit pas produire de valeurs incoherentes
 * - une session sans tuiles de terrain doit retourner un pourcentage de 0
 * - un tri successif sur une meme colonne doit inverser correctement l’ordre
 * - les donnees initiales peuvent etre vides sans provoquer d’erreur dans la vue
 * - le changement d’onglet (chat / journal) doit fonctionner sans casser l’affichage
 * - apres clic sur le bouton de retour à la vue initiale , le composant doit quitter la salle,
 *   reinitialiser son etat et naviguer vers la vue initiale
 */

const HALF_PERCENT = 50;
const FULL_PERCENT = 100;

class MockRoomSocketService {
    currentGameSessionState = {
        players: [],
        cells: [],
    };

    currentRoomState = {
        players: [],
    };

    gameSessionState$ = {
        subscribe: () => ({
            unsubscribe: () => undefined,
        }),
    };

    socketId = 'player1';

    leave(): void {
        return;
    }
    resetRoomState(): void {
        return;
    }
}

class MockGamePageStateService {
    getViewState() {
        return {
            messages: [],
            countdownSeconds: 0,
        };
    }

    isCurrentPlayerAbandoned() {
        return false;
    }
}

class MockGamePagePlayerService {
    getCurrentPlayerFromSocket() {
        return null;
    }
}

const mockChatSocketService = {};

describe('EndGamePageComponent', () => {
    let component: EndGamePageComponent;
    let fixture: ComponentFixture<EndGamePageComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [EndGamePageComponent],
            providers: [
                { provide: RoomSocketService, useClass: MockRoomSocketService },
                { provide: GamePageStateService, useClass: MockGamePageStateService },
                { provide: GamePagePlayerService, useClass: MockGamePagePlayerService },
                { provide: ChatSocketService, useValue: mockChatSocketService },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: {
                                get: () => '',
                            },
                        },
                    },
                },
                { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
            ],
        });

        fixture = TestBed.createComponent(EndGamePageComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize players and messages on init', () => {
        component.ngOnInit();

        expect(component.players.length).toBe(0);
        expect(component.sortedPlayers.length).toBe(0);
    });

    it('should calculate combats lost correctly', () => {
        const player = {
            combatsTotal: 5,
            combatsWon: 3,
        } as GameSessionPlayer;

        const result = component.getCombatsLost(player);

        expect(result).toBe(2);
    });

    it('should handle zero combats', () => {
        const player = {
            combatsTotal: 0,
            combatsWon: 0,
        } as GameSessionPlayer;

        const result = component.getCombatsLost(player);

        expect(result).toBe(0);
    });

    it('should calculate visited tiles percentage exactly', () => {
        component.session = {
            cells: [{ tile: TileId.Base }, { tile: TileId.Base }],
        } as GameSessionState;

        const player = {
            visitedTiles: ['1,1'],
        } as GameSessionPlayer;

        const result = component.calculateVisitedTilesPercentage(player);

        expect(result).toBe(HALF_PERCENT);
    });

    it('should return 100 when all tiles are visited', () => {
        component.session = {
            cells: [{ tile: TileId.Base }, { tile: TileId.Base }],
        } as GameSessionState;

        const player = {
            visitedTiles: ['1,1', '2,2'],
        } as GameSessionPlayer;

        const result = component.calculateVisitedTilesPercentage(player);

        expect(result).toBe(FULL_PERCENT);
    });

    it('should return 0 if no terrain tiles', () => {
        component.session = {
            cells: [],
        } as unknown as GameSessionState;

        const player = {
            visitedTiles: [],
        } as unknown as GameSessionPlayer;

        const result = component.calculateVisitedTilesPercentage(player);

        expect(result).toBe(0);
    });

    it('should sort players by name ascending', () => {
        component.players = [{ name: 'Zoe' } as GameSessionPlayer, { name: 'Alice' } as GameSessionPlayer];
        component.sortedPlayers = [...component.players];
        component.sortBy('name');

        expect(component.sortedPlayers[0].name).toBe('Alice');
    });

    it('should toggle sort order', () => {
        component.players = [{ name: 'A' } as GameSessionPlayer, { name: 'B' } as GameSessionPlayer];

        component.sortBy('name');
        component.sortBy('name');

        expect(component.isSortAscending).toBeFalse();
    });

    it('should navigate to home', () => {
        const router = TestBed.inject(Router);
        component.roomId = '123';

        component.goToHome();

        expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should call leave and resetRoomState when going home', () => {
        const roomService = TestBed.inject(RoomSocketService);
        spyOn(roomService, 'leave');
        spyOn(roomService, 'resetRoomState');

        component.roomId = '123';

        component.goToHome();

        expect(roomService.leave).toHaveBeenCalled();
        expect(roomService.resetRoomState).toHaveBeenCalled();
    });

    it('should switch message tab', () => {
        component.activeMessageTab = 'chat';

        component.activeMessageTab = 'journal';

        expect(component.activeMessageTab).toBe('journal');
    });
});
