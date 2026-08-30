import { Injectable, OnDestroy } from '@angular/core';
import {
    CombatChoosePosturePayload,
    EndTurnPayload,
    GameSessionEvents,
    GameSessionState,
    MovePlayerPayload,
    PerformActionPayload,
    FlagTransferRequestPayload,
    FlagTransferResponsePayload,
    TeleportPlayerPayload,
    ToggleDebugPayload,
} from '@common/game-session';
import { PlayerAvatar, PlayerType } from '@common/player';
import {
    AddVirtualPlayerPayload,
    CreateRoomPayload,
    JoinableRoomSummary,
    JoinRoomPayload,
    KickPlayerPayload,
    LeaveRoomPayload,
    PlayerCharacter,
    ReleaseTemporaryAvatarPayload,
    RequestTakenAvatarsPayload,
    ReserveTemporaryAvatarPayload,
    RoomCancelledPayload,
    RoomErrorPayload,
    RoomEvents,
    RoomKickedPayload,
    RoomState,
    StartRoomPayload,
    TakenAvatarsUpdatedPayload,
} from '@common/wait-room';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { toSocketBaseUrl } from 'src/app/services/socket-url.util';
import { environment } from 'src/environments/environment';

export interface PendingRoomPlayerSetup {
    name: string;
    avatar: PlayerAvatar;
    playerType: PlayerType;
    character: PlayerCharacter;
}

export const roomSocketClientFactory = {
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
export class RoomSocketService implements OnDestroy {
    private readonly socket: Socket;
    private readonly gameSessionStateSubject = new BehaviorSubject<GameSessionState | null>(null);
    private readonly roomStateSubject = new BehaviorSubject<RoomState | null>(null);
    private readonly errorSubject = new Subject<RoomErrorPayload>();
    private readonly cancelledSubject = new Subject<RoomCancelledPayload>();
    private readonly kickedSubject = new Subject<RoomKickedPayload>();
    private readonly startedSubject = new Subject<StartRoomPayload>();
    private readonly joinableRoomsSubject = new BehaviorSubject<JoinableRoomSummary[]>([]);
    private readonly takenAvatarsSubject = new BehaviorSubject<TakenAvatarsUpdatedPayload | null>(null);
    private readonly flagTransferRequestSubject = new Subject<FlagTransferRequestPayload>();
    private pendingPlayerSetup: PendingRoomPlayerSetup | null = null;

    readonly gameSessionState$: Observable<GameSessionState | null> = this.gameSessionStateSubject.asObservable();
    readonly roomState$: Observable<RoomState | null> = this.roomStateSubject.asObservable();
    readonly error$: Observable<RoomErrorPayload> = this.errorSubject.asObservable();
    readonly cancelled$: Observable<RoomCancelledPayload> = this.cancelledSubject.asObservable();
    readonly kicked$: Observable<RoomKickedPayload> = this.kickedSubject.asObservable();
    readonly started$: Observable<StartRoomPayload> = this.startedSubject.asObservable();
    readonly joinableRooms$: Observable<JoinableRoomSummary[]> = this.joinableRoomsSubject.asObservable();
    readonly takenAvatars$: Observable<TakenAvatarsUpdatedPayload | null> = this.takenAvatarsSubject.asObservable();
    readonly flagTransferRequest$: Observable<FlagTransferRequestPayload> = this.flagTransferRequestSubject.asObservable();

    get currentGameSessionState(): GameSessionState | null {
        return this.gameSessionStateSubject.value;
    }

    get currentRoomState(): RoomState | null {
        return this.roomStateSubject.value;
    }

    get socketId(): string {
        return this.socket.id ?? '';
    }

    constructor() {
        this.socket = roomSocketClientFactory.create();

        this.socket.on(RoomEvents.State, (payload: unknown) => {
            if (this.isRoomStatePayload(payload)) {
                this.roomStateSubject.next(payload);
                return;
            }

            if (this.isGameSessionStatePayload(payload)) {
                this.gameSessionStateSubject.next(payload);
            }
        });

        this.socket.on(RoomEvents.Error, (payload: RoomErrorPayload) => {
            this.errorSubject.next(payload);
        });

        this.socket.on(RoomEvents.Cancelled, (payload: RoomCancelledPayload) => {
            this.cancelledSubject.next(payload);
        });

        this.socket.on(RoomEvents.Kicked, (payload: RoomKickedPayload) => {
            this.kickedSubject.next(payload);
        });

        this.socket.on(RoomEvents.Start, (payload: StartRoomPayload) => {
            this.startedSubject.next(payload);
        });

        this.socket.on(RoomEvents.JoinableRooms, (rooms: JoinableRoomSummary[]) => {
            this.joinableRoomsSubject.next(rooms);
        });

        this.socket.on(RoomEvents.TakenAvatarsUpdated, (payload: TakenAvatarsUpdatedPayload) => {
            this.takenAvatarsSubject.next(payload);
        });

        this.socket.on(GameSessionEvents.FlagTransferRequest, (payload: FlagTransferRequestPayload) => {
            this.flagTransferRequestSubject.next(payload);
        });
    }

    create(payload: CreateRoomPayload): void {
        this.socket.emit(RoomEvents.Create, payload);
    }

    resetRoomState(): void {
        this.roomStateSubject.next(null);
        this.gameSessionStateSubject.next(null);
    }

    setPendingPlayerSetup(payload: PendingRoomPlayerSetup): void {
        this.pendingPlayerSetup = payload;
    }

    consumePendingPlayerSetup(): PendingRoomPlayerSetup | null {
        const payload = this.pendingPlayerSetup;
        this.pendingPlayerSetup = null;
        return payload;
    }

    join(payload: JoinRoomPayload): void {
        this.socket.emit(RoomEvents.Join, payload);
    }

    addVirtualPlayer(payload: AddVirtualPlayerPayload): void {
        this.socket.emit(RoomEvents.AddVirtualPlayer, payload);
    }

    requestTakenAvatars(payload: RequestTakenAvatarsPayload): void {
        this.socket.emit(RoomEvents.RequestTakenAvatars, payload);
    }

    reserveTemporaryAvatar(payload: ReserveTemporaryAvatarPayload): void {
        this.socket.emit(RoomEvents.ReserveTemporaryAvatar, payload);
    }

    releaseTemporaryAvatar(payload: ReleaseTemporaryAvatarPayload): void {
        this.socket.emit(RoomEvents.ReleaseTemporaryAvatar, payload);
    }

    leave(payload: LeaveRoomPayload): void {
        this.socket.emit(RoomEvents.Leave, payload);
    }

    kick(payload: KickPlayerPayload): void {
        this.socket.emit(RoomEvents.Kick, payload);
    }

    start(payload: StartRoomPayload): void {
        this.socket.emit(RoomEvents.Start, payload);
    }

    endTurn(payload: EndTurnPayload): void {
        this.socket.emit(GameSessionEvents.EndTurn, payload);
    }

    performAction(payload: PerformActionPayload): void {
        this.socket.emit(GameSessionEvents.PerformAction, payload);
    }

    movePlayer(payload: MovePlayerPayload): void {
        this.socket.emit(GameSessionEvents.MovePlayer, payload);
    }

    teleportPlayer(payload: TeleportPlayerPayload): void {
        this.socket.emit(GameSessionEvents.TeleportPlayer, payload);
    }

    toggleDebug(payload: ToggleDebugPayload): void {
        this.socket.emit(GameSessionEvents.ToggleDebug, payload);
    }

    chooseCombatPosture(payload: CombatChoosePosturePayload): void {
        this.socket.emit(GameSessionEvents.CombatChoosePosture, payload);
    }

    respondToFlagTransfer(payload: FlagTransferResponsePayload): void {
        this.socket.emit(GameSessionEvents.FlagTransferResponse, payload);
    }

    ngOnDestroy(): void {
        this.socket.removeAllListeners(GameSessionEvents.ToggleDebug);
        this.socket.removeAllListeners(GameSessionEvents.TeleportPlayer);
        this.socket.removeAllListeners(GameSessionEvents.PerformAction);
        this.socket.removeAllListeners(GameSessionEvents.EndTurn);
        this.socket.removeAllListeners(GameSessionEvents.State);
        this.socket.removeAllListeners(RoomEvents.State);
        this.socket.removeAllListeners(RoomEvents.Error);
        this.socket.removeAllListeners(RoomEvents.Cancelled);
        this.socket.removeAllListeners(RoomEvents.Kicked);
        this.socket.removeAllListeners(RoomEvents.Start);
        this.socket.removeAllListeners(RoomEvents.JoinableRooms);
        this.socket.removeAllListeners(GameSessionEvents.FlagTransferRequest);
        this.socket.disconnect();
        this.gameSessionStateSubject.complete();
        this.roomStateSubject.complete();
        this.errorSubject.complete();
        this.cancelledSubject.complete();
        this.kickedSubject.complete();
        this.startedSubject.complete();
        this.joinableRoomsSubject.complete();
        this.flagTransferRequestSubject.complete();
        this.socket.removeAllListeners(RoomEvents.TakenAvatarsUpdated);
        this.takenAvatarsSubject.complete();
    }

    private isRoomStatePayload(payload: unknown): payload is RoomState {
        if (!payload || typeof payload !== 'object') {
            return false;
        }

        const candidate = payload as Partial<RoomState>;
        return (
            typeof candidate.roomId === 'string' &&
            typeof candidate.hostId === 'string' &&
            typeof candidate.gameId === 'string' &&
            Array.isArray(candidate.players) &&
            typeof candidate.maxPlayers === 'number'
        );
    }

    private isGameSessionStatePayload(payload: unknown): payload is GameSessionState {
        if (!payload || typeof payload !== 'object') {
            return false;
        }

        const candidate = payload as Partial<GameSessionState>;
        return (
            typeof candidate.sessionId === 'string' &&
            typeof candidate.roomId === 'string' &&
            typeof candidate.gameId === 'string' &&
            Array.isArray(candidate.players) &&
            Array.isArray(candidate.cells)
        );
    }
}
