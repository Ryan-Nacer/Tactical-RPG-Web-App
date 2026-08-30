import { RoomService } from '@app/services/room/room.service';
import { CreateRoomPayload, RoomEvents, JoinRoomPayload, AddVirtualPlayerPayload, StartRoomPayload, RoomState } from '@common/wait-room';
import { Server, Socket } from 'socket.io';
import { emitJoinableRooms, emitRoomError, emitLockChange } from './room.gateway.utils';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { GameService } from '@app/services/game/game.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player.service';
import { Mode } from '@common/game';
import { GameSessionState, GameSessionEvents } from '@common/game-session';
import { ROOM_ERRORS } from './room.constants';

export function handleCreateRoom(
    server: Server,
    roomService: RoomService,
    client: Socket,
    payload: CreateRoomPayload,
    leaveSocketFromAllRooms: (client: Socket) => void,
): void {
    try {
        leaveSocketFromAllRooms(client);

        const room = roomService.createRoom(client.id, payload);

        client.data.roomId = room.roomId;
        client.join(room.roomId);

        server.to(room.roomId).emit(RoomEvents.State, room);
        emitJoinableRooms(server, roomService);
    } catch (error) {
        emitRoomError(client, error);
    }
}

export function handleJoinRoom(params: {
    server: Server;
    roomService: RoomService;
    gameSessionService: GameSessionService;
    client: Socket;
    payload: JoinRoomPayload;
    leaveSocketFromAllRooms: (client: Socket) => void;
}): void {
    const { server, roomService, gameSessionService, client, payload, leaveSocketFromAllRooms } = params;

    try {
        const session = gameSessionService.getSession(payload.roomId);
        if (session) {
            emitRoomError(client, new Error(ROOM_ERRORS.gameAlreadyStarted));
            return;
        }

        leaveSocketFromAllRooms(client);

        const result = roomService.joinRoom(client.id, payload);

        client.data.roomId = payload.roomId;
        client.join(payload.roomId);

        server.to(payload.roomId).emit(RoomEvents.State, result.room);

        if (result.addedPlayer) {
            server.to(payload.roomId).emit(RoomEvents.Joined, {
                roomId: payload.roomId,
                player: result.addedPlayer,
            });
        }

        emitLockChange(server, payload.roomId, result.lockChange);
        emitJoinableRooms(server, roomService);
    } catch (error) {
        emitRoomError(client, error);
    }
}

export function handleAddVirtualPlayerRoom(params: {
    server: Server;
    roomService: RoomService;
    client: Socket;
    payload: AddVirtualPlayerPayload;
}): void {
    const { server, roomService, client, payload } = params;

    try {
        const room = roomService.getRoom(payload.roomId);
        if (!room) {
            emitRoomError(client, new Error(ROOM_ERRORS.notFound));
            return;
        }

        if (room.hostId !== client.id) {
            emitRoomError(client, new Error(ROOM_ERRORS.addVirtualPlayerNotHost));
            return;
        }

        const result = roomService.addVirtualPlayer(payload);

        server.to(payload.roomId).emit(RoomEvents.State, result.room);

        if (result.addedPlayer) {
            server.to(payload.roomId).emit(RoomEvents.Joined, {
                roomId: payload.roomId,
                player: result.addedPlayer,
            });
        }

        emitLockChange(server, payload.roomId, result.lockChange);
        emitJoinableRooms(server, roomService);
    } catch (error) {
        emitRoomError(client, error);
    }
}

export async function handleStartRoom(params: {
    server: Server;
    roomService: RoomService;
    gameService: GameService;
    gameSessionService: GameSessionService;
    virtualPlayerService: VirtualPlayerService;
    client: Socket;
    payload: StartRoomPayload;
    emitSessionStateToRoomPlayers: (room: RoomState, session: GameSessionState) => void;
    closeRoomAfterGameEnd: (session: GameSessionState) => void;
}): Promise<void> {
    const {
        server,
        roomService,
        gameService,
        gameSessionService,
        virtualPlayerService,
        client,
        payload,
        emitSessionStateToRoomPlayers,
        closeRoomAfterGameEnd,
    } = params;

    try {
        const room = roomService.getRoom(payload.roomId);

        if (!room) {
            emitRoomError(client, new Error(ROOM_ERRORS.notFound));
            return;
        }

        if (room.hostId !== client.id) {
            emitRoomError(client, new Error(ROOM_ERRORS.notHost));
            return;
        }

        if (room.players.length < 2) {
            emitRoomError(client, new Error(ROOM_ERRORS.minPlayers));
            return;
        }

        const game = await gameService.getGame(room.gameId);
        if (!game) {
            emitRoomError(client, new Error(ROOM_ERRORS.gameNotFound));
            return;
        }

        if (game.mode === Mode.CTF && room.players.length % 2 !== 0) {
            emitRoomError(client, new Error(ROOM_ERRORS.invalidCtfPlayers));
            return;
        }

        virtualPlayerService.configureRoom(room);

        const session = gameSessionService.createSession(
            room,
            game,
            (updatedSession) => {
                emitSessionStateToRoomPlayers(room, updatedSession);
                virtualPlayerService.onGameStateUpdate(updatedSession);

                if (updatedSession.winnerPlayerId) {
                    closeRoomAfterGameEnd(updatedSession);
                }
            },
            (combatEndPayload) => {
                server.to(combatEndPayload.attackerId).to(combatEndPayload.defenderId).emit(GameSessionEvents.CombatEnd, combatEndPayload);
            },
        );

        roomService.markRoomAsStarted(payload.roomId);

        emitJoinableRooms(server, roomService);

        emitSessionStateToRoomPlayers(room, session);

        server.to(payload.roomId).emit(RoomEvents.Start, {
            roomId: payload.roomId,
        });
    } catch (error) {
        emitRoomError(client, error);
    }
}

export function handleLeaveRoomAction(params: { server: Server; roomService: RoomService; client: Socket; roomId: string }): void {
    const { server, roomService, client, roomId } = params;

    const room = roomService.getRoom(roomId);

    if (room && room.hostId === client.id) {
        server.to(roomId).emit('roomClosed', {
            message: ROOM_ERRORS.roomClosedByHost,
        });

        roomService.removeRoom(roomId);
        emitJoinableRooms(server, roomService);
    }

    client.leave(roomId);
}
