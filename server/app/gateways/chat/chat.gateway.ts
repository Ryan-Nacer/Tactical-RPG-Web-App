import { CHAT_EVENTS, CHAT_NAMESPACE } from '@common/chat-events';
import { ChatMessage } from '@common/chat-message';
import { SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from '@app/services/room/room.service';

const MAX_CHAT_MESSAGE_LENGTH = 200;

@WebSocketGateway({ namespace: CHAT_NAMESPACE, cors: true })
export class ChatGateway {
    @WebSocketServer() server: Server;

    constructor(private readonly roomService: RoomService) {}

    @SubscribeMessage(CHAT_EVENTS.SendMessage)
    handleMessage(client: Socket, payload: ChatMessage): void {
        if (!payload || !payload.roomId || !payload.playerId || typeof payload.text !== 'string') {
            return;
        }

        const normalizedText = payload.text.trim();
        if (!normalizedText || normalizedText.length > MAX_CHAT_MESSAGE_LENGTH) {
            return;
        }

        if (!client.rooms.has(payload.roomId)) {
            return;
        }
        const room = this.roomService.getRoom(payload.roomId);
        if (!room) {
            return;
        }

        const player = room.players.find((p) => p.id === payload.playerId);
        if (!player) {
            return;
        }

        this.server.to(payload.roomId).emit(CHAT_EVENTS.Message, {
            roomId: payload.roomId,
            playerId: payload.playerId,
            sender: player.name,
            text: normalizedText,
            time: payload.time,
        });
    }

    @SubscribeMessage(CHAT_EVENTS.JoinRoom)
    handleJoinRoom(client: Socket, roomId: string): void {
        if (!roomId || client.rooms.has(roomId)) {
            return;
        }

        this.leaveOtherRooms(client, roomId);
        client.join(roomId);
    }

    @SubscribeMessage(CHAT_EVENTS.LeaveRoom)
    handleLeaveRoom(client: Socket, roomId: string): void {
        if (!roomId || !client.rooms.has(roomId)) {
            return;
        }

        client.leave(roomId);
    }

    private leaveOtherRooms(client: Socket, targetRoomId: string): void {
        for (const roomId of client.rooms) {
            if (roomId === client.id || roomId === targetRoomId) {
                continue;
            }

            client.leave(roomId);
        }
    }
}
