import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

export type GameListUpdateType = 'deleted' | 'visibility' | 'created';

export interface GameListUpdatePayload {
    type: GameListUpdateType;
    gameId: string;
    visible?: boolean;
}

const GAME_LIST_UPDATED_EVENT = 'gameListUpdated';

@Injectable({
    providedIn: 'root',
})
export class GameSocketService implements OnDestroy {
    private readonly socket: Socket;
    private readonly listUpdatedSubject = new Subject<GameListUpdatePayload>();

    readonly gameListUpdated$: Observable<GameListUpdatePayload> = this.listUpdatedSubject.asObservable();

    constructor() {
        const socketUrl = environment.serverUrl.replace(/\/api\/?$/, '');
        this.socket = io(socketUrl, {
            transports: ['websocket'],
        });

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
