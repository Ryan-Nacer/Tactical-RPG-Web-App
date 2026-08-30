import { GameSessionService } from '@app/services/game-session/game-session.service';
import { RoomService, LeaveRoomResult } from '@app/services/room/room.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player.service';
import { GameSessionPlayer, GameSessionState } from '@common/game-session';
import {
    KickPlayerPayload,
    ReleaseTemporaryAvatarPayload,
    RequestTakenAvatarsPayload,
    ReserveTemporaryAvatarPayload,
    RoomCancelledPayload,
    RoomErrorPayload,
    RoomEvents,
    RoomKickedPayload,
    RoomLeftPayload,
    RoomLockedPayload,
    RoomUnlockedPayload,
    TakenAvatarsUpdatedPayload,
} from '@common/wait-room';
import { Server, Socket } from 'socket.io';

type LockChange = 'locked' | 'unlocked' | 'unchanged';

type RoomGatewayContext = {
    server: Server;
    roomService: RoomService;
    gameSessionService: GameSessionService;
    virtualPlayerService?: VirtualPlayerService;
};
export function emitRoomError(client: Socket, error: unknown): void {
    const payload: RoomErrorPayload = {
        code: 'ROOM_ERROR',
        message: error instanceof Error ? error.message : 'Erreur inconnue.',
    };
    client.emit(RoomEvents.Error, payload);
}

export function emitJoinableRooms(server: Server, roomService: RoomService): void {
    const joinableRooms = roomService.getJoinableRooms();
    server.emit(RoomEvents.JoinableRooms, joinableRooms);
}

export function emitLockChange(server: Server, roomId: string, lockChange: LockChange): void {
    if (lockChange === 'locked') {
        const payload: RoomLockedPayload = {
            roomId,
            isLocked: true,
            reason: 'maxReached',
        };
        server.to(roomId).emit(RoomEvents.Locked, payload);
    }

    if (lockChange === 'unlocked') {
        const payload: RoomUnlockedPayload = {
            roomId,
            isLocked: false,
            reason: 'slotFreed',
        };
        server.to(roomId).emit(RoomEvents.Unlocked, payload);
    }
}

function emitTakenAvatarsUpdated(server: Server, roomService: RoomService, roomId: string): void {
    const avatars = roomService.getUnavailableAvatars(roomId);
    const responsePayload: TakenAvatarsUpdatedPayload = {
        roomId,
        avatars,
    };

    server.to(roomId).emit(RoomEvents.TakenAvatarsUpdated, responsePayload);
}

export function handleRequestTakenAvatars(server: Server, roomService: RoomService, payload: RequestTakenAvatarsPayload, client: Socket): void {
    if (!payload?.roomId) {
        emitRoomError(client, new Error('Salle introuvable.'));
        return;
    }

    client.join(payload.roomId);

    const avatars = roomService.getUnavailableAvatars(payload.roomId);
    const responsePayload: TakenAvatarsUpdatedPayload = {
        roomId: payload.roomId,
        avatars,
    };

    client.emit(RoomEvents.TakenAvatarsUpdated, responsePayload);
    server.to(payload.roomId).emit(RoomEvents.TakenAvatarsUpdated, responsePayload);
}

export function handleReserveTemporaryAvatar(server: Server, roomService: RoomService, payload: ReserveTemporaryAvatarPayload, client: Socket): void {
    if (!payload?.roomId) {
        emitRoomError(client, new Error('Salle introuvable.'));
        return;
    }

    roomService.reserveTemporaryAvatar(payload.roomId, client.id, payload.avatar);
    emitTakenAvatarsUpdated(server, roomService, payload.roomId);
}

export function handleReleaseTemporaryAvatar(server: Server, roomService: RoomService, payload: ReleaseTemporaryAvatarPayload, client: Socket): void {
    if (!payload?.roomId) {
        emitRoomError(client, new Error('Salle introuvable.'));
        return;
    }

    roomService.freeTemporaryReservation(payload.roomId, client.id);
    emitTakenAvatarsUpdated(server, roomService, payload.roomId);
}

export function handleKickPlayer(server: Server, roomService: RoomService, payload: KickPlayerPayload, client: Socket): void {
    const room = roomService.getRoom(payload.roomId);

    if (!room) {
        emitRoomError(client, new Error('Salle introuvable.'));
        return;
    }

    if (room.hostId !== client.id) {
        emitRoomError(client, new Error("Seul l'organisateur peut exclure un joueur."));
        return;
    }

    const result = roomService.kickPlayer(payload.roomId, payload.playerId);

    if (!result.removedPlayer || !result.room) {
        return;
    }

    const kickedPayload: RoomKickedPayload = {
        roomId: payload.roomId,
        playerId: result.removedPlayer.id,
        playerName: result.removedPlayer.name,
        byHostId: client.id,
        message: 'Vous avez ete exclu de la salle.',
    };

    server.to(payload.playerId).emit(RoomEvents.Kicked, kickedPayload);
    server.in(payload.playerId).socketsLeave(payload.roomId);
    const kickedClient = server.sockets.sockets.get(payload.playerId);
    if (kickedClient) {
        kickedClient.data.roomId = undefined;
    }

    server.to(payload.roomId).emit(RoomEvents.State, result.room);
    emitLockChange(server, payload.roomId, result.lockChange);
    emitJoinableRooms(server, roomService);
}

export function removePlayer(context: RoomGatewayContext, client: Socket, roomId: string, reason: 'left' | 'disconnected'): void {
    const { roomService } = context;

    if (handleSessionCase(context, client, roomId)) {
        return;
    }

    const result = roomService.leaveRoom(roomId, client.id);

    if (result.wasHost) {
        handleHostLeave(context, roomId);
        return;
    }

    handleRegularLeave(context, result, roomId, reason);
}

function handleSessionCase(context: RoomGatewayContext, client: Socket, roomId: string): boolean {
    const { server, roomService, gameSessionService, virtualPlayerService } = context;

    const session = gameSessionService.getSession(roomId);
    if (session) {
        const abandonResult = gameSessionService.abandonPlayer(roomId, client.id);
        client.leave(roomId);
        client.data.roomId = undefined;

        if (abandonResult.cancellationMessage) {
            roomService.removeRoom(roomId);
            virtualPlayerService?.clearRoom(roomId);
            const payload: RoomCancelledPayload = {
                roomId,
                reason: 'gameCancelled',
                message: abandonResult.cancellationMessage,
            };
            server.to(roomId).emit(RoomEvents.Cancelled, payload);
            emitJoinableRooms(server, roomService);
        }
        return true;
    }

    return false;
}

function handleHostLeave(context: RoomGatewayContext, roomId: string): void {
    const { server, roomService, gameSessionService, virtualPlayerService } = context;

    gameSessionService.removeSession(roomId);
    virtualPlayerService?.clearRoom(roomId);
    const payload: RoomCancelledPayload = {
        roomId,
        reason: 'hostLeft',
        message: "L'organisateur a quitte la salle.",
    };
    server.to(roomId).emit(RoomEvents.Cancelled, payload);
    emitJoinableRooms(server, roomService);
}

function handleRegularLeave(context: RoomGatewayContext, result: LeaveRoomResult, roomId: string, reason: 'left' | 'disconnected'): void {
    const { server, roomService } = context;

    if (!result.removedPlayer || !result.room) {
        return;
    }

    const leftPayload: RoomLeftPayload = {
        roomId,
        playerId: result.removedPlayer.id,
        playerName: result.removedPlayer.name,
        reason,
    };

    server.to(roomId).emit(RoomEvents.Left, leftPayload);
    server.to(roomId).emit(RoomEvents.State, result.room);
    emitLockChange(server, roomId, result.lockChange);
    emitJoinableRooms(server, roomService);
}

export function getSessionOrEmitError(gameSessionService: GameSessionService, roomId: string, client: Socket): GameSessionState | null {
    const session = gameSessionService.getSession(roomId);
    if (!session) {
        emitRoomError(client, new Error('Session de jeu introuvable.'));
        return null;
    }

    return session;
}

export function isTurnPhase(session: GameSessionState, client: Socket, errorMessage: string): boolean {
    if (session.phase === 'turn') {
        return true;
    }

    emitRoomError(client, new Error(errorMessage));
    return false;
}

export function isActivePlayerClient(session: GameSessionState, client: Socket, errorMessage: string): boolean {
    if (session.activePlayerId === client.id) {
        return true;
    }

    emitRoomError(client, new Error(errorMessage));
    return false;
}

export function getPlayerById(session: GameSessionState, playerId: string): GameSessionPlayer | null {
    return session.players.find((player) => player.id === playerId) ?? null;
}
