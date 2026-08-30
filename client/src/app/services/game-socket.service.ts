import { Injectable, OnDestroy } from '@angular/core';
import { GameListUpdatePayload } from '@app/interfaces/game';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { toSocketBaseUrl } from 'src/app/services/socket-url.util';
import { environment } from 'src/environments/environment';

const GAME_LIST_UPDATED_EVENT = 'gameListUpdated';

export const gameSocketClientFactory = {
    create(): Socket {
        const socketUrl = toSocketBaseUrl(environment.serverUrl);
        return io(socketUrl, {
            transports: ['websocket'],
        });
    },
};

@Injectable({
    providedIn: 'root',
})
export class GameSocketService implements OnDestroy {
    private readonly socket: Socket;
    private readonly listUpdatedSubject = new Subject<GameListUpdatePayload>();

    readonly gameListUpdated$: Observable<GameListUpdatePayload> = this.listUpdatedSubject.asObservable();

    constructor() {
        this.socket = gameSocketClientFactory.create();

        this.socket.on(GAME_LIST_UPDATED_EVENT, (payload: GameListUpdatePayload) => {
            this.listUpdatedSubject.next(payload);
        });
    }

    ngOnDestroy(): void {
        this.socket.removeAllListeners(GAME_LIST_UPDATED_EVENT);
        this.socket.disconnect();
        this.listUpdatedSubject.complete();
    }
}
