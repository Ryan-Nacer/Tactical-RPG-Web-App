import { GridSize } from '@common/game';
import { GameSessionEvents, GameSessionState } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';
import {
    JoinableRoomSummary,
    RoomCancelledPayload,
    RoomErrorPayload,
    RoomEvents,
    RoomKickedPayload,
    RoomState,
    StartRoomPayload,
    TakenAvatarsUpdatedPayload,
} from '@common/wait-room';
import { RoomSocketService, roomSocketClientFactory } from './room-socket.service';

/**
 * Strategie :
 * - tester RoomSocketService comme adaptation cliente directe au protocole Socket.IO
 * - verifier le relais des evenements entrants, les emissions sortantes et le nettoyage
 *   des listeners a la destruction
 *
 * Cas limites cibles :
 * - le pending setup doit etre consomme une seule fois
 * - resetRoomState doit nettoyer l'etat local sans toucher au socket
 * - ngOnDestroy doit liberer tous les listeners pour eviter les abonnements zombies
 */
describe('RoomSocketService', () => {
    const roomState: RoomState = {
        roomId: 'ROOM01',
        hostId: 'host-1',
        gameId: 'game-1',
        gameName: 'Jeu test',
        maxPlayers: 2,
        isLocked: false,
        mode: 'CLASSIC',
        players: [
            {
                id: 'host-1',
                name: 'Host',
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
    const sessionState: GameSessionState = {
        sessionId: 'ROOM01',
        roomId: 'ROOM01',
        gameId: 'game-1',
        gridSize: GridSize.Small,
        cells: [],
        players: [],
        activePlayerId: 'host-1',
        phase: 'turn',
        countdownMode: 'turn',
        countdownCombatPlayerIds: [],
        turnRemainingSeconds: 30,
        debugMode: false,
        messages: [],
    };
    const roomError: RoomErrorPayload = { code: 'ROOM_ERROR', message: 'Salle introuvable.' };
    const roomCancelled: RoomCancelledPayload = { roomId: 'ROOM01', reason: 'hostLeft', message: "L'organisateur a quitte." };
    const roomKicked: RoomKickedPayload = {
        roomId: 'ROOM01',
        playerId: 'player-2',
        playerName: 'Guest',
        byHostId: 'host-1',
        message: 'Vous avez ete exclu.',
    };
    const roomStarted: StartRoomPayload = { roomId: 'ROOM01' };
    const joinableRooms: JoinableRoomSummary[] = [
        { roomId: 'ROOM01', hostName: 'Host', gameName: 'Jeu test', currentPlayers: 1, maxPlayers: 2, isLocked: false, mode: 'CLASSIC' },
    ];
    const takenAvatars: TakenAvatarsUpdatedPayload = {
        roomId: 'ROOM01',
        avatars: [AvatarName.Barbie],
    };

    let callbacks: Map<string, ((payload: unknown) => void)[]>;
    let mockSocket: {
        id: string;
        emit: jasmine.Spy;
        on: jasmine.Spy;
        removeAllListeners: jasmine.Spy;
        disconnect: jasmine.Spy;
    };
    let service: RoomSocketService;

    const trigger = <T>(event: string, payload: T, callbackIndex = 0) => {
        const eventCallbacks = callbacks.get(event);
        expect(eventCallbacks?.[callbackIndex]).toBeDefined();
        eventCallbacks?.[callbackIndex]?.(payload);
    };

    beforeEach(() => {
        callbacks = new Map();
        mockSocket = {
            id: 'socket-1',
            emit: jasmine.createSpy('emit'),
            on: jasmine.createSpy('on').and.callFake((event: string, callback: (payload: unknown) => void) => {
                callbacks.set(event, [...(callbacks.get(event) ?? []), callback]);
                return mockSocket;
            }),
            removeAllListeners: jasmine.createSpy('removeAllListeners'),
            disconnect: jasmine.createSpy('disconnect'),
        };

        spyOn(roomSocketClientFactory, 'create').and.returnValue(mockSocket as never);
        service = new RoomSocketService();
    });

    afterEach(() => {
        service?.ngOnDestroy();
    });

    it('should expose the socket id and relay the room state events', () => {
        const receivedRoomStates: RoomState[] = [];
        const receivedSessions: GameSessionState[] = [];

        service.roomState$.subscribe((room) => room && receivedRoomStates.push(room));
        service.gameSessionState$.subscribe((session) => session && receivedSessions.push(session));

        trigger(RoomEvents.State, roomState, 0);
        trigger(GameSessionEvents.State, sessionState, 0);

        expect(service.socketId).toBe('socket-1');
        expect(service.currentRoomState).toEqual(roomState);
        expect(service.currentGameSessionState).toEqual(sessionState);
        expect(receivedRoomStates).toEqual([roomState]);
        expect(receivedSessions).toEqual([sessionState]);
    });

    it('should relay error, cancellation, kick, start, joinable rooms and taken avatars events', () => {
        let receivedError: RoomErrorPayload | undefined;
        let receivedCancelled: RoomCancelledPayload | undefined;
        let receivedKicked: RoomKickedPayload | undefined;
        let receivedStarted: StartRoomPayload | undefined;
        let receivedJoinableRooms: JoinableRoomSummary[] | undefined;
        let receivedTakenAvatars: TakenAvatarsUpdatedPayload | null | undefined;

        service.error$.subscribe((payload) => (receivedError = payload));
        service.cancelled$.subscribe((payload) => (receivedCancelled = payload));
        service.kicked$.subscribe((payload) => (receivedKicked = payload));
        service.started$.subscribe((payload) => (receivedStarted = payload));
        service.joinableRooms$.subscribe((payload) => (receivedJoinableRooms = payload));
        service.takenAvatars$.subscribe((payload) => (receivedTakenAvatars = payload));

        trigger(RoomEvents.Error, roomError);
        trigger(RoomEvents.Cancelled, roomCancelled);
        trigger(RoomEvents.Kicked, roomKicked);
        trigger(RoomEvents.Start, roomStarted);
        trigger(RoomEvents.JoinableRooms, joinableRooms);
        trigger(RoomEvents.TakenAvatarsUpdated, takenAvatars);

        expect(receivedError).toEqual(roomError);
        expect(receivedCancelled).toEqual(roomCancelled);
        expect(receivedKicked).toEqual(roomKicked);
        expect(receivedStarted).toEqual(roomStarted);
        expect(receivedJoinableRooms).toEqual(joinableRooms);
        expect(receivedTakenAvatars).toEqual(takenAvatars);
    });

    it('should emit all room and game session commands through the socket', () => {
        const payloads = {
            create: {
                name: 'Host',
                avatar: { avatarName: AvatarName.Barbie, imageUrl: 'assets/barbie.png' },
                playerType: PlayerType.HumanPlayer,
                character: roomState.players[0].character,
                gameId: 'game-1',
                gameName: 'Jeu test',
                gridSize: GridSize.Small,
                mode: 'CLASSIC',
            },
            join: {
                roomId: 'ROOM01',
                name: 'Guest',
                avatar: { avatarName: AvatarName.Ken, imageUrl: 'assets/ken.png' },
                playerType: PlayerType.HumanPlayer,
                character: roomState.players[0].character,
            },
            roomIdOnly: { roomId: 'ROOM01' },
            kick: { roomId: 'ROOM01', playerId: 'player-2' },
            requestTakenAvatars: { roomId: 'ROOM01' },
            reserveTemporaryAvatar: { roomId: 'ROOM01', avatar: AvatarName.Barbie },
            releaseTemporaryAvatar: { roomId: 'ROOM01' },
            move: { roomId: 'ROOM01', row: 1, column: 2 },
            action: { roomId: 'ROOM01', row: 2, column: 3 },
            toggleDebug: { roomId: 'ROOM01' },
        };

        service.create(payloads.create);
        service.join(payloads.join);
        service.leave(payloads.roomIdOnly);
        service.kick(payloads.kick);
        service.start(payloads.roomIdOnly);
        service.endTurn(payloads.roomIdOnly);
        service.performAction(payloads.action);
        service.movePlayer(payloads.move);
        service.teleportPlayer(payloads.move);
        service.toggleDebug(payloads.toggleDebug);
        service.requestTakenAvatars(payloads.requestTakenAvatars);
        service.reserveTemporaryAvatar(payloads.reserveTemporaryAvatar);
        service.releaseTemporaryAvatar(payloads.releaseTemporaryAvatar);

        expect(mockSocket.emit.calls.allArgs()).toEqual([
            [RoomEvents.Create, payloads.create],
            [RoomEvents.Join, payloads.join],
            [RoomEvents.Leave, payloads.roomIdOnly],
            [RoomEvents.Kick, payloads.kick],
            [RoomEvents.Start, payloads.roomIdOnly],
            [GameSessionEvents.EndTurn, payloads.roomIdOnly],
            [GameSessionEvents.PerformAction, payloads.action],
            [GameSessionEvents.MovePlayer, payloads.move],
            [GameSessionEvents.TeleportPlayer, payloads.move],
            [GameSessionEvents.ToggleDebug, payloads.toggleDebug],
            [RoomEvents.RequestTakenAvatars, payloads.requestTakenAvatars],
            [RoomEvents.ReserveTemporaryAvatar, payloads.reserveTemporaryAvatar],
            [RoomEvents.ReleaseTemporaryAvatar, payloads.releaseTemporaryAvatar],
        ]);
    });

    it('should store pending player setup until it is consumed once', () => {
        const pendingSetup = {
            name: 'Guest',
            avatar: { avatarName: AvatarName.Ken, imageUrl: 'assets/ken.png' },
            playerType: PlayerType.HumanPlayer,
            character: roomState.players[0].character,
        };

        service.setPendingPlayerSetup(pendingSetup);

        expect(service.consumePendingPlayerSetup()).toEqual(pendingSetup);
        expect(service.consumePendingPlayerSetup()).toBeNull();
    });

    it('should reset the local room and game state without touching the socket', () => {
        trigger(RoomEvents.State, roomState);
        trigger(GameSessionEvents.State, sessionState);
        mockSocket.emit.calls.reset();

        service.resetRoomState();

        expect(service.currentRoomState).toBeNull();
        expect(service.currentGameSessionState).toBeNull();
        expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should remove all listeners and disconnect on destroy', () => {
        service.ngOnDestroy();

        expect(mockSocket.removeAllListeners.calls.allArgs()).toEqual([
            [GameSessionEvents.ToggleDebug],
            [GameSessionEvents.TeleportPlayer],
            [GameSessionEvents.PerformAction],
            [GameSessionEvents.EndTurn],
            [GameSessionEvents.State],
            [RoomEvents.State],
            [RoomEvents.Error],
            [RoomEvents.Cancelled],
            [RoomEvents.Kicked],
            [RoomEvents.Start],
            [RoomEvents.JoinableRooms],
            [GameSessionEvents.FlagTransferRequest],
            [RoomEvents.TakenAvatarsUpdated],
        ]);
        expect(mockSocket.disconnect).toHaveBeenCalled();
    });
});
