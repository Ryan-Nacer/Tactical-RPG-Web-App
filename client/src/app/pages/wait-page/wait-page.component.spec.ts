import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { ChatSocketService } from '@app/services/chat/chat-socket.service';
import { ConfigService } from '@app/services/config.service';
import { NotificationService } from '@app/services/notifications/notification.service';
import { RoomSocketService } from '@app/services/room-socket.service';
import { AvatarName, PlayerType } from '@common/player';
import { Playstyle, RoomState } from '@common/wait-room';
import { BehaviorSubject, Subject } from 'rxjs';
import { WaitPageComponent } from './wait-page.component';

@Component({ selector: 'app-chat-zone', standalone: true, template: '' })
class MockChatZoneComponent {
    @Input() roomId = '';
    @Input() currentUser = '';
    @Input() playerId = '';
    @Input() isAbandoned = false;
}

/**
 * Strategie :
 * - tester la salle d'attente comme page cliente qui orchestre la jonction socket,
 *   l'etat de salle et les composants enfants affichant erreurs et clavardage
 * - verifier les reactions critiques sans tester toute l'interface visuelle
 *
 * Cas limites cibles :
 * - salle introuvable => nettoyage, message utilisateur et redirection
 * - destruction du composant avant le debut de partie => leave explicite
 *
 * Ces cas sont importants parce que l'utilisateur peut rejoindre une salle invalide
 * ou quitter la vue d'attente a tout moment pendant la fonctionnalite Sprint 2.
 */
describe('WaitPageComponent', () => {
    let component: WaitPageComponent;
    let fixture: ComponentFixture<WaitPageComponent>;
    let routerSpy: jasmine.SpyObj<Router>;
    let roomSocketServiceSpy: jasmine.SpyObj<RoomSocketService>;
    let chatSocketServiceSpy: jasmine.SpyObj<ChatSocketService>;
    let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
    let configServiceSpy: jasmine.SpyObj<ConfigService>;
    let roomStateSubject: BehaviorSubject<RoomState | null>;
    let startedSubject: Subject<{ roomId: string }>;
    let errorSubject: Subject<{ message: string }>;
    let cancelledSubject: Subject<{ message: string }>;
    let kickedSubject: Subject<{ message: string }>;

    const roomState: RoomState = {
        roomId: 'ROOM01',
        hostId: 'host-1',
        gameId: 'game-1',
        gameName: 'Jeux test',
        maxPlayers: 2,
        isLocked: false,
        mode: 'CLASSIC',
        players: [
            {
                id: 'host-1',
                name: 'Alice',
                avatar: { avatarName: AvatarName.Barbie, imageUrl: 'assets/barbie.png' },
                playerType: PlayerType.HumanPlayer,
                character: {
                    health: 6,
                    maxHealth: 6,
                    speed: 4,
                    attack: 4,
                    defense: 4,
                    attackDice: 'D4',
                    defenseDice: 'D6',
                    movementPointsLeft: 4,
                    combatSanctuaryPointsLeft: 0,
                    actionsLeft: 1,
                },
            },
        ],
    };

    beforeEach(async () => {
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        roomStateSubject = new BehaviorSubject<RoomState | null>(roomState);
        startedSubject = new Subject<{ roomId: string }>();
        errorSubject = new Subject<{ message: string }>();
        cancelledSubject = new Subject<{ message: string }>();
        kickedSubject = new Subject<{ message: string }>();
        roomSocketServiceSpy = jasmine.createSpyObj(
            'RoomSocketService',
            ['addVirtualPlayer', 'consumePendingPlayerSetup', 'join', 'leave', 'start', 'kick', 'resetRoomState'],
            {
                currentRoomState: null,
                roomState$: roomStateSubject,
                started$: startedSubject,
                error$: errorSubject,
                cancelled$: cancelledSubject,
                kicked$: kickedSubject,
            },
        );
        chatSocketServiceSpy = jasmine.createSpyObj('ChatSocketService', ['leaveRoom']);
        notificationServiceSpy = jasmine.createSpyObj('NotificationService', ['error', 'warning']);
        configServiceSpy = jasmine.createSpyObj('ConfigService', ['getPlayerAvatars']);
        configServiceSpy.getPlayerAvatars.and.returnValue([
            { avatarName: AvatarName.Ken, imageUrl: 'assets/ken.png' },
            { avatarName: AvatarName.Nikki, imageUrl: 'assets/nikki.png' },
        ]);
        roomSocketServiceSpy.consumePendingPlayerSetup.and.returnValue(null);

        await TestBed.configureTestingModule({
            imports: [WaitPageComponent],
            providers: [
                { provide: Router, useValue: routerSpy },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: convertToParamMap({ room: 'ROOM01', gameId: 'game-1', name: 'Alice', host: 'true' }),
                        },
                    },
                },
                { provide: RoomSocketService, useValue: roomSocketServiceSpy },
                { provide: ChatSocketService, useValue: chatSocketServiceSpy },
                { provide: NotificationService, useValue: notificationServiceSpy },
                { provide: ConfigService, useValue: configServiceSpy },
            ],
        })
            .overrideComponent(WaitPageComponent, {
                set: { imports: [MockChatZoneComponent] },
            })
            .compileComponents();

        fixture = TestBed.createComponent(WaitPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should join the requested room on init using the query params', () => {
        expect(roomSocketServiceSpy.join).toHaveBeenCalledWith(
            jasmine.objectContaining({
                roomId: 'ROOM01',
                name: 'Alice',
                playerType: PlayerType.HumanPlayer,
            }),
        );
    });

    it('should pass the current room and user to the child components', () => {
        const chatZone = fixture.debugElement.query(By.directive(MockChatZoneComponent)).componentInstance as MockChatZoneComponent;

        expect(chatZone.roomId).toBe('ROOM01');
        expect(chatZone.currentUser).toBe('Alice');
        expect(chatZone.playerId).toBe('host-1');
    });

    it('should redirect to the home page when the room is reported as missing', () => {
        errorSubject.next({ message: 'Salle introuvable.' });

        expect(notificationServiceSpy.error).toHaveBeenCalledWith('Salle introuvable.');
        expect(chatSocketServiceSpy.leaveRoom).toHaveBeenCalledWith('ROOM01');
        expect(roomSocketServiceSpy.resetRoomState).toHaveBeenCalled();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
    });

    it('should navigate to the game page when the room starts', () => {
        startedSubject.next({ roomId: 'ROOM01' });

        expect(routerSpy.navigate).toHaveBeenCalledWith(['/game'], {
            queryParams: {
                room: 'ROOM01',
                gameId: 'game-1',
                playerId: 'host-1',
            },
        });
    });

    it('should redirect to the home page when the room is cancelled', () => {
        cancelledSubject.next({ message: "L'organisateur a quitte la salle." });

        expect(notificationServiceSpy.warning).toHaveBeenCalledWith("L'organisateur a quitte la salle.");
        expect(chatSocketServiceSpy.leaveRoom).toHaveBeenCalledWith('ROOM01');
        expect(roomSocketServiceSpy.resetRoomState).toHaveBeenCalled();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
    });

    it('should redirect to the home page when the player is kicked', () => {
        kickedSubject.next({ message: 'Vous avez ete exclu de la salle.' });

        expect(notificationServiceSpy.warning).toHaveBeenCalledWith('Vous avez ete exclu de la salle.');
        expect(chatSocketServiceSpy.leaveRoom).toHaveBeenCalledWith('ROOM01');
        expect(roomSocketServiceSpy.resetRoomState).toHaveBeenCalled();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
    });

    it('should not start the game when the host cannot start yet', () => {
        component.players = [roomState.players[0]];

        component.startGame();

        expect(roomSocketServiceSpy.start).not.toHaveBeenCalled();
    });

    it('should start the game when the host has enough players', () => {
        component.players = [
            roomState.players[0],
            {
                ...roomState.players[0],
                id: 'player-2',
                name: 'Bob',
                avatar: { avatarName: AvatarName.Ken, imageUrl: 'assets/ken.png' },
            },
        ];

        component.startGame();

        expect(roomSocketServiceSpy.start).toHaveBeenCalledWith({ roomId: 'ROOM01' });
    });

    it('should leave the room explicitly and redirect to the home page', () => {
        component.leaveRoom();

        expect(roomSocketServiceSpy.leave).toHaveBeenCalledWith({ roomId: 'ROOM01' });
        expect(chatSocketServiceSpy.leaveRoom).toHaveBeenCalledWith('ROOM01');
        expect(roomSocketServiceSpy.resetRoomState).toHaveBeenCalled();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
    });

    it('should kick a player through the room socket service', () => {
        component.kickPlayer('player-2');

        expect(roomSocketServiceSpy.kick).toHaveBeenCalledWith({
            roomId: 'ROOM01',
            playerId: 'player-2',
        });
    });

    it('should add a virtual player through the room socket service', () => {
        component.addVirtualPlayer(Playstyle.Offensive);

        expect(roomSocketServiceSpy.addVirtualPlayer).toHaveBeenCalledWith({
            roomId: 'ROOM01',
            playstyle: Playstyle.Offensive,
            playerAvatars: configServiceSpy.getPlayerAvatars(),
        });
    });

    it('should ignore a kick request when no room is selected', () => {
        component.currentRoomId = '';

        component.kickPlayer('player-2');

        expect(roomSocketServiceSpy.kick).not.toHaveBeenCalled();
    });

    it('should clear the stale room view state when the cached room differs from the requested room', () => {
        Object.defineProperty(roomSocketServiceSpy, 'currentRoomState', {
            configurable: true,
            value: { ...roomState, roomId: 'OLDROOM' },
        });
        roomSocketServiceSpy.resetRoomState.calls.reset();

        component.ngOnInit();

        expect(roomSocketServiceSpy.resetRoomState).toHaveBeenCalled();
    });

    it('should leave the room and the chat when destroyed before the game starts', () => {
        component.ngOnDestroy();

        expect(roomSocketServiceSpy.leave).toHaveBeenCalledWith({ roomId: 'ROOM01' });
        expect(chatSocketServiceSpy.leaveRoom).toHaveBeenCalledWith('ROOM01');
    });
});
