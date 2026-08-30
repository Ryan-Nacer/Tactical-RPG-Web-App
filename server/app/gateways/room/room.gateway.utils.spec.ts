import { GameSessionService } from '@app/services/game-session/game-session.service';
import { RoomService } from '@app/services/room/room.service';
import { AvatarName, PlayerType } from '@common/player';
import { KickPlayerPayload, RequestTakenAvatarsPayload, ReserveTemporaryAvatarPayload, RoomEvents, RoomState } from '@common/wait-room';
import { Server, Socket } from 'socket.io';
import {
    emitLockChange,
    emitRoomError,
    handleKickPlayer,
    handleReleaseTemporaryAvatar,
    handleRequestTakenAvatars,
    handleReserveTemporaryAvatar,
    removePlayer,
} from './room.gateway.utils';

/**
 * Strategie :
 * - tester directement les utilitaires du RoomGateway qui encapsulent les emissions socket
 *   et la coordination avec RoomService/GameSessionService
 * - verifier les branches d'erreur et les effets de bord serveur les plus critiques
 *
 * Cas limites cibles :
 * - payload incomplet ou salle absente
 * - exclusion reservee a l'organisateur
 * - depart d'un joueur en salle normale versus abandon en session active
 *
 * Ces tests completent ceux du gateway principal en ciblant les helpers qui portent
 * une partie importante de la logique observable du flux de salle.
 */
describe('room.gateway.utils', () => {
    const roomId = 'ROOM01';
    const hostId = 'host-1';
    const guestId = 'player-2';

    let roomToEmit: jest.Mock;
    let broadcastEmit: jest.Mock;
    let socketsLeave: jest.Mock;
    let server: jest.Mocked<Pick<Server, 'to' | 'emit' | 'in' | 'sockets'>>;
    let client: jest.Mocked<Pick<Socket, 'id' | 'emit' | 'join' | 'leave' | 'data'>>;
    let roomService: jest.Mocked<
        Pick<
            RoomService,
            | 'getJoinableRooms'
            | 'getUnavailableAvatars'
            | 'reserveTemporaryAvatar'
            | 'freeTemporaryReservation'
            | 'getRoom'
            | 'kickPlayer'
            | 'leaveRoom'
            | 'removeRoom'
        >
    >;
    let gameSessionService: jest.Mocked<Pick<GameSessionService, 'getSession' | 'abandonPlayer' | 'removeSession'>>;

    const room: RoomState = {
        roomId,
        hostId,
        gameId: 'game-1',
        gameName: 'Jeu test',
        maxPlayers: 2,
        isLocked: true,
        mode: 'CLASSIC',
        players: [
            {
                id: hostId,
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
            {
                id: guestId,
                name: 'Guest',
                avatar: { avatarName: AvatarName.Ken, imageUrl: 'assets/ken.png' },
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

    beforeEach(() => {
        roomToEmit = jest.fn();
        broadcastEmit = jest.fn();
        socketsLeave = jest.fn();

        server = {
            to: jest.fn().mockReturnValue({ emit: roomToEmit }),
            emit: broadcastEmit,
            in: jest.fn().mockReturnValue({ socketsLeave }),
            sockets: { sockets: new Map([[guestId, { data: { roomId } }]]) } as Server['sockets'],
        };

        client = {
            id: hostId,
            emit: jest.fn(),
            join: jest.fn(),
            leave: jest.fn(),
            data: { roomId },
        };

        roomService = {
            getJoinableRooms: jest.fn(),
            getUnavailableAvatars: jest.fn(),
            reserveTemporaryAvatar: jest.fn(),
            freeTemporaryReservation: jest.fn(),
            getRoom: jest.fn(),
            kickPlayer: jest.fn(),
            leaveRoom: jest.fn(),
            removeRoom: jest.fn(),
        };

        gameSessionService = {
            getSession: jest.fn(),
            abandonPlayer: jest.fn(),
            removeSession: jest.fn(),
        };
    });

    const createClient = (id: string): jest.Mocked<Pick<Socket, 'id' | 'emit' | 'join' | 'leave' | 'data'>> => ({
        id,
        emit: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        data: { roomId },
    });

    it('emitRoomError should normalize known and unknown errors', () => {
        emitRoomError(client as unknown as Socket, new Error('Salle introuvable.'));
        emitRoomError(client as unknown as Socket, 'boom');

        expect(client.emit.mock.calls).toEqual([
            [RoomEvents.Error, { code: 'ROOM_ERROR', message: 'Salle introuvable.' }],
            [RoomEvents.Error, { code: 'ROOM_ERROR', message: 'Erreur inconnue.' }],
        ]);
    });

    it('emitLockChange should emit the expected room events', () => {
        emitLockChange(server as unknown as Server, roomId, 'locked');
        emitLockChange(server as unknown as Server, roomId, 'unlocked');
        emitLockChange(server as unknown as Server, roomId, 'unchanged');

        expect(roomToEmit.mock.calls).toEqual([
            [RoomEvents.Locked, { roomId, isLocked: true, reason: 'maxReached' }],
            [RoomEvents.Unlocked, { roomId, isLocked: false, reason: 'slotFreed' }],
        ]);
    });

    it('handleRequestTakenAvatars should reject a missing room id', () => {
        handleRequestTakenAvatars(
            server as unknown as Server,
            roomService as unknown as RoomService,
            {} as RequestTakenAvatarsPayload,
            client as unknown as Socket,
        );

        expect(client.join).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Salle introuvable.',
        });
    });

    it('handleRequestTakenAvatars should join the room and broadcast the unavailable avatars', () => {
        roomService.getUnavailableAvatars.mockReturnValue([AvatarName.Barbie, AvatarName.Ken]);

        handleRequestTakenAvatars(server as unknown as Server, roomService as unknown as RoomService, { roomId }, client as unknown as Socket);

        expect(client.join).toHaveBeenCalledWith(roomId);
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.TakenAvatarsUpdated, {
            roomId,
            avatars: [AvatarName.Barbie, AvatarName.Ken],
        });
        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.TakenAvatarsUpdated, {
            roomId,
            avatars: [AvatarName.Barbie, AvatarName.Ken],
        });
    });

    it('handleReserveTemporaryAvatar should reject a missing room id and otherwise update taken avatars', () => {
        const payload: ReserveTemporaryAvatarPayload = { roomId, avatar: AvatarName.Barbie };
        roomService.getUnavailableAvatars.mockReturnValue([AvatarName.Barbie]);

        handleReserveTemporaryAvatar(
            server as unknown as Server,
            roomService as unknown as RoomService,
            {} as ReserveTemporaryAvatarPayload,
            client as unknown as Socket,
        );
        handleReserveTemporaryAvatar(server as unknown as Server, roomService as unknown as RoomService, payload, client as unknown as Socket);

        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Salle introuvable.',
        });
        expect(roomService.reserveTemporaryAvatar).toHaveBeenCalledWith(roomId, hostId, AvatarName.Barbie);
        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.TakenAvatarsUpdated, {
            roomId,
            avatars: [AvatarName.Barbie],
        });
    });

    it('handleReleaseTemporaryAvatar should free the reservation and refresh taken avatars', () => {
        roomService.getUnavailableAvatars.mockReturnValue([AvatarName.Ken]);

        handleReleaseTemporaryAvatar(server as unknown as Server, roomService as unknown as RoomService, { roomId }, client as unknown as Socket);

        expect(roomService.freeTemporaryReservation).toHaveBeenCalledWith(roomId, hostId);
        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.TakenAvatarsUpdated, {
            roomId,
            avatars: [AvatarName.Ken],
        });
    });

    it('handleKickPlayer should reject a missing room or a non-host client', () => {
        const payload: KickPlayerPayload = { roomId, playerId: guestId };
        const guestClient = createClient(guestId);
        roomService.getRoom.mockReturnValueOnce(undefined).mockReturnValueOnce(room);

        handleKickPlayer(server as unknown as Server, roomService as unknown as RoomService, payload, guestClient as unknown as Socket);
        handleKickPlayer(server as unknown as Server, roomService as unknown as RoomService, payload, guestClient as unknown as Socket);

        expect(roomService.kickPlayer).not.toHaveBeenCalled();
        expect(guestClient.emit.mock.calls).toEqual([
            [RoomEvents.Error, { code: 'ROOM_ERROR', message: 'Salle introuvable.' }],
            [RoomEvents.Error, { code: 'ROOM_ERROR', message: "Seul l'organisateur peut exclure un joueur." }],
        ]);
    });

    it('handleKickPlayer should emit the kick, update room state and refresh joinable rooms', () => {
        roomService.getRoom.mockReturnValue(room);
        roomService.kickPlayer.mockReturnValue({
            room: { ...room, players: [room.players[0]], isLocked: false },
            removedPlayer: room.players[1],
            wasHost: false,
            lockChange: 'unlocked',
        });
        roomService.getJoinableRooms.mockReturnValue([
            { roomId, hostName: 'Host', gameName: 'Jeu test', currentPlayers: 1, maxPlayers: 2, isLocked: false, mode: 'CLASSIC' },
        ]);

        handleKickPlayer(
            server as unknown as Server,
            roomService as unknown as RoomService,
            { roomId, playerId: guestId },
            client as unknown as Socket,
        );

        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.Kicked, {
            roomId,
            playerId: guestId,
            playerName: 'Guest',
            byHostId: hostId,
            message: 'Vous avez ete exclu de la salle.',
        });
        expect(socketsLeave).toHaveBeenCalledWith(roomId);
        expect((server.sockets.sockets.get(guestId) as { data: { roomId?: string } }).data.roomId).toBeUndefined();
        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.State, { ...room, players: [room.players[0]], isLocked: false });
        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.Unlocked, { roomId, isLocked: false, reason: 'slotFreed' });
        expect(broadcastEmit).toHaveBeenCalledWith(RoomEvents.JoinableRooms, [
            { roomId, hostName: 'Host', gameName: 'Jeu test', currentPlayers: 1, maxPlayers: 2, isLocked: false, mode: 'CLASSIC' },
        ]);
    });

    it('removePlayer should cancel the room when an active session is abandoned and the game must stop', () => {
        gameSessionService.getSession.mockReturnValue({ roomId } as never);
        gameSessionService.abandonPlayer.mockReturnValue({
            cancellationMessage: 'La partie est annulee apres abandon.',
        });
        roomService.getJoinableRooms.mockReturnValue([]);

        removePlayer(
            {
                server: server as unknown as Server,
                roomService: roomService as unknown as RoomService,
                gameSessionService: gameSessionService as unknown as GameSessionService,
            },
            client as unknown as Socket,
            roomId,
            'disconnected',
        );

        expect(client.leave).toHaveBeenCalledWith(roomId);
        expect(client.data.roomId).toBeUndefined();
        expect(roomService.removeRoom).toHaveBeenCalledWith(roomId);
        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.Cancelled, {
            roomId,
            reason: 'gameCancelled',
            message: 'La partie est annulee apres abandon.',
        });
        expect(broadcastEmit).toHaveBeenCalledWith(RoomEvents.JoinableRooms, []);
    });

    it('removePlayer should cancel the room when the host leaves before the game starts', () => {
        gameSessionService.getSession.mockReturnValue(undefined);
        roomService.leaveRoom.mockReturnValue({
            removedPlayer: room.players[0],
            wasHost: true,
            lockChange: 'unchanged',
        });
        roomService.getJoinableRooms.mockReturnValue([]);

        removePlayer(
            {
                server: server as unknown as Server,
                roomService: roomService as unknown as RoomService,
                gameSessionService: gameSessionService as unknown as GameSessionService,
            },
            client as unknown as Socket,
            roomId,
            'left',
        );

        expect(gameSessionService.removeSession).toHaveBeenCalledWith(roomId);
        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.Cancelled, {
            roomId,
            reason: 'hostLeft',
            message: "L'organisateur a quitte la salle.",
        });
        expect(broadcastEmit).toHaveBeenCalledWith(RoomEvents.JoinableRooms, []);
    });

    it('removePlayer should notify the room when a regular player leaves', () => {
        const guestClient = createClient(guestId);
        gameSessionService.getSession.mockReturnValue(undefined);
        roomService.leaveRoom.mockReturnValue({
            room: { ...room, players: [room.players[0]], isLocked: false },
            removedPlayer: room.players[1],
            wasHost: false,
            lockChange: 'unlocked',
        });
        roomService.getJoinableRooms.mockReturnValue([
            { roomId, hostName: 'Host', gameName: 'Jeu test', currentPlayers: 1, maxPlayers: 2, isLocked: false, mode: 'CLASSIC' },
        ]);

        removePlayer(
            {
                server: server as unknown as Server,
                roomService: roomService as unknown as RoomService,
                gameSessionService: gameSessionService as unknown as GameSessionService,
            },
            guestClient as unknown as Socket,
            roomId,
            'left',
        );

        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.Left, {
            roomId,
            playerId: guestId,
            playerName: 'Guest',
            reason: 'left',
        });
        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.State, { ...room, players: [room.players[0]], isLocked: false });
        expect(roomToEmit).toHaveBeenCalledWith(RoomEvents.Unlocked, { roomId, isLocked: false, reason: 'slotFreed' });
        expect(broadcastEmit).toHaveBeenCalledWith(RoomEvents.JoinableRooms, [
            { roomId, hostName: 'Host', gameName: 'Jeu test', currentPlayers: 1, maxPlayers: 2, isLocked: false, mode: 'CLASSIC' },
        ]);
    });
});
