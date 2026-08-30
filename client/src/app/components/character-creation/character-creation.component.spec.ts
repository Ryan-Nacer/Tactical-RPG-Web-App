/* eslint-disable max-lines */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ConfigService } from '@app/services/config.service';
import { RoomSocketService } from '@app/services/room-socket.service';
import { GridSize } from '@common/game';
import { AvatarName, PlayerAvatar, PlayerType } from '@common/player';
import { RoomState, TakenAvatarsUpdatedPayload } from '@common/wait-room';
import { BehaviorSubject, Subject } from 'rxjs';
import { CharacterCreationComponent } from './character-creation.component';

const DEFAULT_LIFE_VALUE = 6;
const DEFAULT_SPEED_VALUE = 6;
const BONUS_VALUE = 2;
const FIRST_AVATAR_INDEX = 0;
const SECOND_AVATAR_INDEX = 1;
const RANDOM_AVATAR_INDEX = 2;
const HIGH_RANDOM_VALUE = 0.8;
const LOW_RANDOM_VALUE = 0.2;
const VERY_HIGH_RANDOM_VALUE = 0.9;
const MOCK_SOCKET_ID = 'host-1';

/**
 * Strategie :
 * - tester le composant de creation de personnage comme point d'entrée du joueur avant la salle d'attente
 * - verifier l’initialisation du composant a partir des query params
 * - verifier les interactions utilisateur : selection d’avatar, choix des bonus, assignation des des
 * - tester la generation aleatoire du personnage
 * - valider le comportement lors de la sauvegarde selon le role (host vs joueur)
 *
 * Cas limites cibles :
 * - aucun avatar selectionne lors de la sauvegarde => aucune action effectuee
 * - nom de joueur vide => réutilisation du nom de l’avatar
 * - joueur non-host => navigation directe vers la salle d’attente sans creation de salle
 * - host => creation de la salle puis  navigation
 * - formulaire incomplet => bouton de sauvegarde desactive
 *
 * Ces cas sont utiles parce que la fonctionnalite de creation de personnage est une etape critique
 * avant l’entree dans la salle d’attente
 * et doit garantir la coherence des donnees envoyees au serveur.
 */

describe('CharacterCreationComponent', () => {
    let component: CharacterCreationComponent;
    let fixture: ComponentFixture<CharacterCreationComponent>;
    let configServiceSpy: jasmine.SpyObj<ConfigService>;
    let routerSpy: jasmine.SpyObj<Router>;
    let roomSocketServiceSpy: jasmine.SpyObj<RoomSocketService>;
    let roomStateSubject: BehaviorSubject<RoomState | null>;
    let takenAvatarsSubject: BehaviorSubject<TakenAvatarsUpdatedPayload | null>;
    let errorSubject: Subject<{ message: string }>;
    let cancelledSubject: Subject<{ roomId: string; reason: 'hostLeft' | 'gameCancelled'; message: string }>;
    let routeQueryParams: Record<string, string>;

    const mockPlayerAvatars: PlayerAvatar[] = [
        { imageUrl: 'barbie.png', avatarName: AvatarName.Barbie },
        { imageUrl: 'ken.png', avatarName: AvatarName.Ken },
        { imageUrl: 'nikki.png', avatarName: AvatarName.Nikki },
    ];

    const emittedRoomState: RoomState = {
        roomId: 'ROOM01',
        hostId: 'host-1',
        gameId: 'game-1',
        gameName: 'Jeux test',
        players: [],
        maxPlayers: 2,
        isLocked: false,
        mode: 'CLASSIC',
    };

    const createComponent = async (queryParams: Record<string, string> = {}) => {
        routeQueryParams = queryParams;

        fixture?.destroy();
        fixture = TestBed.createComponent(CharacterCreationComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    };

    beforeEach(async () => {
        sessionStorage.clear();
        routeQueryParams = {};
        configServiceSpy = jasmine.createSpyObj('ConfigService', ['getPlayerAvatars']);
        configServiceSpy.getPlayerAvatars.and.returnValue(mockPlayerAvatars);

        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        roomStateSubject = new BehaviorSubject<RoomState | null>(null);
        takenAvatarsSubject = new BehaviorSubject<TakenAvatarsUpdatedPayload | null>(null);
        errorSubject = new Subject<{ message: string }>();
        cancelledSubject = new Subject<{ roomId: string; reason: 'hostLeft' | 'gameCancelled'; message: string }>();
        roomSocketServiceSpy = jasmine.createSpyObj(
            'RoomSocketService',
            ['setPendingPlayerSetup', 'resetRoomState', 'create', 'join', 'requestTakenAvatars', 'reserveTemporaryAvatar', 'releaseTemporaryAvatar'],
            {
                roomState$: roomStateSubject.asObservable(),
                takenAvatars$: takenAvatarsSubject.asObservable(),
                error$: errorSubject.asObservable(),
                cancelled$: cancelledSubject.asObservable(),
                socketId: MOCK_SOCKET_ID,
            },
        );

        await TestBed.configureTestingModule({
            imports: [CharacterCreationComponent],
            providers: [
                { provide: ConfigService, useValue: configServiceSpy },
                { provide: Router, useValue: routerSpy },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        get snapshot() {
                            return {
                                queryParamMap: convertToParamMap(routeQueryParams),
                            };
                        },
                    },
                },
                { provide: RoomSocketService, useValue: roomSocketServiceSpy },
            ],
        }).compileComponents();

        await createComponent();
    });

    afterEach(() => {
        fixture?.destroy();
        sessionStorage.clear();
        roomStateSubject.complete();
        takenAvatarsSubject.complete();
        errorSubject.complete();
        cancelledSubject.complete();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    /*
    it('should display the default Sprint 1 attribute values', () => {
        const text = fixture.nativeElement.textContent;

        expect(text).toContain(`Vie : ${DEFAULT_LIFE_VALUE}`);
        expect(text).toContain(`Rapidité : ${DEFAULT_SPEED_VALUE}`);
        expect(text).toContain('Attaque : D4');
        expect(text).toContain('Défense : D4');
    });*/

    it('should parse the route query params on init', async () => {
        await createComponent({ host: 'true', gameId: 'game-1', gameName: 'Jeux test', room: 'ROOM01', gridSize: String(GridSize.Small) });

        expect(component.isHost).toBeTrue();
        expect(component.gameId).toBe('game-1');
        expect(component.gameName).toBe('Jeux test');
        expect(component.roomId).toBe('ROOM01');
        expect(component.gridSize).toBe(GridSize.Small);
    });

    it('should set the avatar and use its name when the player name is empty', () => {
        const selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];

        component.onAvatarSelected({ avatar: selectedAvatar, visibleIndex: FIRST_AVATAR_INDEX });

        expect(component.selectedAvatar).toBe(selectedAvatar);
        expect(component.name).toBe(selectedAvatar.avatarName);
    });

    it('should keep the typed player name when selecting an avatar', () => {
        component.name = 'Custom Name';

        component.onAvatarSelected({ avatar: mockPlayerAvatars[SECOND_AVATAR_INDEX], visibleIndex: SECOND_AVATAR_INDEX });

        expect(component.selectedAvatar).toBe(mockPlayerAvatars[SECOND_AVATAR_INDEX]);
        expect(component.name).toBe('Custom Name');
    });

    it('should update the name when the selected avatar changes and the current name still matches the previous avatar', () => {
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];
        component.name = mockPlayerAvatars[FIRST_AVATAR_INDEX].avatarName;

        component.onAvatarSelected({ avatar: mockPlayerAvatars[SECOND_AVATAR_INDEX], visibleIndex: SECOND_AVATAR_INDEX });

        expect(component.selectedAvatar).toBe(mockPlayerAvatars[SECOND_AVATAR_INDEX]);
        expect(component.name).toBe(mockPlayerAvatars[SECOND_AVATAR_INDEX].avatarName);
    });

    it('should reserve a selected avatar temporarily when a room is known', () => {
        const avatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];
        component.roomId = 'room-123';

        component.onAvatarSelected({ avatar, visibleIndex: 2 });

        expect(roomSocketServiceSpy.reserveTemporaryAvatar).toHaveBeenCalledWith({
            roomId: 'room-123',
            avatar: avatar.avatarName,
        });
    });

    it('should release the previous temporary avatar reservation before reserving a new one', () => {
        component.roomId = 'room-123';
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];

        component.onAvatarSelected({ avatar: mockPlayerAvatars[SECOND_AVATAR_INDEX], visibleIndex: 2 });

        expect(roomSocketServiceSpy.releaseTemporaryAvatar).toHaveBeenCalledWith({
            roomId: 'room-123',
        });
        expect(roomSocketServiceSpy.reserveTemporaryAvatar).toHaveBeenCalledWith({
            roomId: 'room-123',
            avatar: mockPlayerAvatars[SECOND_AVATAR_INDEX].avatarName,
        });
    });

    it('should clear the selected avatar when the avatar list emits null', () => {
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];

        component.onAvatarSelected(null);

        expect(component.selectedAvatar).toBeNull();
    });

    it('should release temporary avatar reservation when the avatar list emits null in a room', () => {
        component.roomId = 'room-123';
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];

        component.onAvatarSelected(null);

        expect(roomSocketServiceSpy.releaseTemporaryAvatar).toHaveBeenCalledWith({
            roomId: 'room-123',
        });
    });

    it('should clear the selected avatar and refresh the availability list when the server rejects the reservation', () => {
        component.roomId = 'ROOM99';
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];

        errorSubject.next({ message: 'Avatar indisponible' });

        expect(component.selectedAvatar).toBeNull();
        expect(component.avatarAvailabilityMessage).toContain('Cet avatar vient');
        expect(roomSocketServiceSpy.requestTakenAvatars).toHaveBeenCalledWith({ roomId: 'ROOM99' });
    });

    it('should clear the availability warning after a new avatar is selected', () => {
        component.roomId = 'ROOM99';
        component.avatarAvailabilityMessage = "Cet avatar vient d'etre pris.";

        component.onAvatarSelected({ avatar: mockPlayerAvatars[SECOND_AVATAR_INDEX], visibleIndex: SECOND_AVATAR_INDEX });

        expect(component.avatarAvailabilityMessage).toBe('');
    });

    it('should apply the selected bonus and reset the other primary attribute', () => {
        component.attributes.life = DEFAULT_LIFE_VALUE + BONUS_VALUE;
        component.attributes.speed = DEFAULT_SPEED_VALUE + BONUS_VALUE;

        component.applyBonus('life');

        expect(component.attributes.life).toBe(DEFAULT_LIFE_VALUE + BONUS_VALUE);
        expect(component.attributes.speed).toBe(DEFAULT_SPEED_VALUE);
        expect(component.bonusAttributeLabel).toBe('Vie');
    });

    it('should assign complementary dice values', () => {
        component.assignDice('D6');

        expect(component.dice.attack).toBe('D6');
        expect(component.dice.defense).toBe('D4');
    });

    it('should highlight the favored statistics cards', () => {
        component.applyBonus('speed');
        component.assignDice('D6');
        fixture.detectChanges();

        const statCards = fixture.debugElement.queryAll(By.css('.stat'));

        expect(statCards[1].nativeElement.classList).toContain('favored');
        expect(statCards[2].nativeElement.classList).toContain('favored');
        expect(statCards[0].nativeElement.classList).not.toContain('favored');
        expect(statCards[3].nativeElement.classList).not.toContain('favored');
    });

    it('should generate a deterministic random character when Math.random is mocked', () => {
        spyOn(Math, 'random').and.returnValues(HIGH_RANDOM_VALUE, LOW_RANDOM_VALUE, VERY_HIGH_RANDOM_VALUE);

        component.generateRandomCharacter();

        expect(configServiceSpy.getPlayerAvatars).toHaveBeenCalled();
        expect(component.randomAvatarIndex()).toBe(RANDOM_AVATAR_INDEX);
        expect(component.bonusAttribute).toBe('life');
        expect(component.attributes.life).toBe(DEFAULT_LIFE_VALUE + BONUS_VALUE);
        expect(component.dice.attack).toBe('D6');
        expect(component.dice.defense).toBe('D4');
    });

    it('should update the name when a random character replaces an avatar-derived name', () => {
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];
        component.name = mockPlayerAvatars[FIRST_AVATAR_INDEX].avatarName;
        spyOn(Math, 'random').and.returnValues(HIGH_RANDOM_VALUE, LOW_RANDOM_VALUE, VERY_HIGH_RANDOM_VALUE);

        component.generateRandomCharacter();

        expect(component.selectedAvatar).toBe(mockPlayerAvatars[RANDOM_AVATAR_INDEX]);
        expect(component.name).toBe(mockPlayerAvatars[RANDOM_AVATAR_INDEX].avatarName);
    });

    it('should ignore saveAvatarChoice when no avatar is selected', () => {
        component.saveAvatarChoice();

        expect(roomSocketServiceSpy.setPendingPlayerSetup).not.toHaveBeenCalled();
        expect(roomSocketServiceSpy.join).not.toHaveBeenCalled();
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should prepare the player setup and send a join request for a non-host player', () => {
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];
        component.name = ' Player One ';
        component.roomId = 'ROOM99';
        component.gameId = 'game-1';
        component.isHost = false;
        component.applyBonus('speed');

        component.saveAvatarChoice();

        expect(roomSocketServiceSpy.setPendingPlayerSetup).toHaveBeenCalledWith(
            jasmine.objectContaining({
                name: 'Player One',
                avatar: mockPlayerAvatars[FIRST_AVATAR_INDEX],
                playerType: PlayerType.HumanPlayer,
                character: jasmine.objectContaining({
                    health: DEFAULT_LIFE_VALUE,
                    speed: DEFAULT_SPEED_VALUE + BONUS_VALUE,
                    attackDice: 'D4',
                    defenseDice: 'D6',
                }),
            }),
        );

        expect(roomSocketServiceSpy.join).toHaveBeenCalledWith(
            jasmine.objectContaining({
                roomId: 'ROOM99',
                name: 'Player One',
                avatar: mockPlayerAvatars[FIRST_AVATAR_INDEX],
                playerType: PlayerType.HumanPlayer,
                character: jasmine.objectContaining({
                    health: DEFAULT_LIFE_VALUE,
                    speed: DEFAULT_SPEED_VALUE + BONUS_VALUE,
                }),
            }),
        );

        expect(routerSpy.navigate).not.toHaveBeenCalled();
        expect(roomSocketServiceSpy.create).not.toHaveBeenCalled();
    });

    it('should navigate to the wait page for a non-host player after receiving room state', () => {
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];
        component.name = 'Player One';
        component.roomId = 'ROOM99';
        component.gameId = 'game-1';
        component.isHost = false;
        component.applyBonus('speed');

        component.saveAvatarChoice();

        roomStateSubject.next({
            ...emittedRoomState,
            roomId: 'ROOM99',
        });

        expect(routerSpy.navigate).toHaveBeenCalledWith(['/wait'], {
            queryParams: {
                room: 'ROOM99',
                name: 'Player One',
                gameId: 'game-1',
                host: false,
            },
        });
    });

    it('should return to the home page when the room becomes unavailable during character creation', () => {
        component.roomId = 'ROOM99';
        component.isHost = false;

        errorSubject.next({ message: 'Salle introuvable.' });

        expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should store a host-left notice when the room disappears while a player is joining', () => {
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];
        component.name = 'Player One';
        component.roomId = 'ROOM99';
        component.gameId = 'game-1';
        component.isHost = false;

        component.saveAvatarChoice();
        errorSubject.next({ message: 'Salle introuvable.' });

        expect(sessionStorage.getItem('home-redirect-notice')).toBe("L'organisateur a quitté la salle.");
        expect(sessionStorage.getItem('home-redirect-notice-level')).toBe('warning');
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should return to the home page when the room is cancelled during character creation', () => {
        component.roomId = 'ROOM99';
        component.isHost = false;

        cancelledSubject.next({ roomId: 'ROOM99', reason: 'hostLeft', message: "L'organisateur a quitte la salle." });

        expect(sessionStorage.getItem('home-redirect-notice')).toBe("L'organisateur a quitte la salle.");
        expect(sessionStorage.getItem('home-redirect-notice-level')).toBe('warning');
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should create a room and navigate when the host receives a room state', () => {
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];
        component.name = 'Host Player';
        component.gameId = 'game-1';
        component.gameName = 'Jeux test';
        component.gridSize = GridSize.Small;
        component.isHost = true;
        component.applyBonus('life');

        component.saveAvatarChoice();
        roomStateSubject.next(emittedRoomState);

        expect(roomSocketServiceSpy.resetRoomState).toHaveBeenCalled();
        expect(roomSocketServiceSpy.create).toHaveBeenCalledWith(
            jasmine.objectContaining({
                name: 'Host Player',
                avatar: mockPlayerAvatars[FIRST_AVATAR_INDEX],
                playerType: PlayerType.HumanPlayer,
                gameId: 'game-1',
                gameName: 'Jeux test',
                gridSize: GridSize.Small,
                character: jasmine.objectContaining({
                    health: DEFAULT_LIFE_VALUE + BONUS_VALUE,
                    maxHealth: DEFAULT_LIFE_VALUE + BONUS_VALUE,
                }),
            }),
        );
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/wait'], {
            queryParams: {
                room: 'ROOM01',
                name: 'Host Player',
                gameId: 'game-1',
                host: true,
            },
        });
    });

    it('should not create a room when host data is incomplete', () => {
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];
        component.isHost = true;
        component.name = 'Host Player';
        component.applyBonus('life');

        component.saveAvatarChoice();

        expect(roomSocketServiceSpy.setPendingPlayerSetup).toHaveBeenCalled();
        expect(roomSocketServiceSpy.create).not.toHaveBeenCalled();
        expect(routerSpy.navigate).not.toHaveBeenCalled();
    });

    it('should enable the save button once the form and the character setup are complete', async () => {
        const saveButton: HTMLButtonElement = fixture.debugElement.query(By.css('.save-button')).nativeElement;
        const nameInput: HTMLInputElement = fixture.debugElement.query(By.css('input[name="characterName"]')).nativeElement;

        expect(saveButton.disabled).toBeTrue();

        nameInput.value = 'Ready Player';
        nameInput.dispatchEvent(new Event('input'));
        component.selectedAvatar = mockPlayerAvatars[FIRST_AVATAR_INDEX];
        component.applyBonus('life');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(saveButton.disabled).toBeFalse();
    });
});
