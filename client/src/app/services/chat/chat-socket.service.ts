import { Injectable, OnDestroy } from '@angular/core';
import { CHAT_EVENTS, CHAT_NAMESPACE } from '@common/chat-events';
import { ChatMessage } from '@common/chat-message';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { toSocketBaseUrl } from 'src/app/services/socket-url.util';
import { environment } from 'src/environments/environment';

export const chatSocketClientFactory = {
    create(): Socket {
        const socketUrl = toSocketBaseUrl(environment.serverUrl);
        return io(`${socketUrl}/${CHAT_NAMESPACE}`, {
            transports: ['websocket'],
        });
    },
};

@Injectable({ providedIn: 'root' })
export class ChatSocketService implements OnDestroy {
    private socket: Socket;
    private activeRoomId: string | null = null;
    private readonly messageHistory = new BehaviorSubject<ChatMessage[]>([]);
    readonly messages$: Observable<ChatMessage[]> = this.messageHistory.asObservable();

    constructor() {
        this.socket = chatSocketClientFactory.create();

        this.socket.on('connect', () => {
            if (this.activeRoomId) {
                this.socket.emit(CHAT_EVENTS.JoinRoom, this.activeRoomId);
            }
        });

        this.socket.on(CHAT_EVENTS.Message, (message: ChatMessage) => {
            if (!this.activeRoomId || message.roomId !== this.activeRoomId) {
                return;
            }
            const currentMessages = this.messageHistory.value;
            this.messageHistory.next([...currentMessages, message]);
        });
    }

    sendMessage(roomId: string, sender: string, text: string, playerId: string): void {
        const time = new Date().toLocaleTimeString('fr-FR', { hour12: false });
        const message: ChatMessage = { text, sender, time, roomId, playerId };
        this.socket.emit(CHAT_EVENTS.SendMessage, message);
    }

    joinRoom(roomId: string): void {
        if (!roomId) {
            return;
        }

        if (this.activeRoomId === roomId) {
            return;
        }

        if (this.activeRoomId) {
            this.socket.emit(CHAT_EVENTS.LeaveRoom, this.activeRoomId);
        }

        this.activeRoomId = roomId;
        this.messageHistory.next([]);
        this.socket.emit(CHAT_EVENTS.JoinRoom, roomId);
    }

    leaveRoom(roomId: string): void {
        if (!roomId) {
            return;
        }

        if (this.activeRoomId === roomId) {
            this.activeRoomId = null;
            this.messageHistory.next([]);
        }

        this.socket.emit(CHAT_EVENTS.LeaveRoom, roomId);
    }

    ngOnDestroy(): void {
        this.socket.disconnect();
    }
}
