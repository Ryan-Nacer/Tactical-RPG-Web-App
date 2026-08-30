import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatZoneComponent } from '@app/components/chat-zone/chat-zone.component';
import { ChatSocketService } from '@app/services/chat/chat-socket.service';
import { ConfigService } from '@app/services/config.service';
import { NotificationService } from '@app/services/notifications/notification.service';
import { PendingRoomPlayerSetup, RoomSocketService } from '@app/services/room-socket.service';
import { AvatarName, PlayerType } from '@common/player';
import { JoinRoomPayload, Playstyle, PlayerCharacter, PlayerSummary, RoomState, VirtualPlayerSummary } from '@common/wait-room';
import { Subscription } from 'rxjs';

const DEFAULT_PLAYER_NAME_PREFIX = 'Joueur-';
const RANDOM_NAME_UPPER_BOUND = 1000;
const DEFAULT_AVATAR_IMAGE_URL = 'assets/characters/barbie.png';
const DEFAULT_HEALTH = 6;
const DEFAULT_SPEED = 6;
const DEFAULT_ATTACK = 4;
const DEFAULT_DEFENSE = 4;

@Component({
    selector: 'app-wait-page',
    standalone: true,
    imports: [ChatZoneComponent],
    templateUrl: './wait-page.component.html',
    styleUrl: './wait-page.component.scss',
})
export class WaitPageComponent implements OnInit, OnDestroy {
    room: RoomState | null = null;
    players: PlayerSummary[] = [];
    maxPlayers = 0;
    isCurrentUserHost = false;
    showVirtualPlayerOptions = false;
    currentGameId = '';
    currentRoomId = '';
    name = '';
    currentPlayerId = '';
    readonly playstyle = Playstyle;
    private isNavigatingToGame = false;
    private readonly configService = inject(ConfigService);

    pendingPlayerSetup: PendingRoomPlayerSetup | null = null;

    private readonly subscriptions = new Subscription();

    constructor(
        private readonly roomSocketService: RoomSocketService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly chatSocketService: ChatSocketService,
        private readonly notificationService: NotificationService,
    ) {}

    ngOnInit(): void {
        const queryParams = this.route.snapshot.queryParamMap;
        const roomId = queryParams.get('room') ?? '';
        const gameId = queryParams.get('gameId') ?? '';
        const name = queryParams.get('name') ?? `${DEFAULT_PLAYER_NAME_PREFIX}${Math.floor(Math.random() * RANDOM_NAME_UPPER_BOUND)}`;
        const isHost = queryParams.get('host') === 'true';
        const existingRoomState = this.roomSocketService.currentRoomState;
        this.pendingPlayerSetup = this.roomSocketService.consumePendingPlayerSetup();

        if (existingRoomState && existingRoomState.roomId !== roomId) {
            this.clearRoomViewState();
        }

        this.isCurrentUserHost = isHost;
        this.currentGameId = gameId;
        this.currentRoomId = roomId;
        this.name = name;

        if (roomId) {
            this.tryJoinRoom();
        }

        this.subscriptions.add(
            this.roomSocketService.roomState$.subscribe((room) => {
                this.room = room;
                this.players = room?.players ?? [];
                this.maxPlayers = room?.maxPlayers ?? 0;
                this.currentGameId = room?.gameId ?? this.currentGameId;

                this.updateCurrentPlayer(room, this.pendingPlayerSetup);
            }),
        );

        this.subscriptions.add(
            this.roomSocketService.started$.subscribe((payload) => {
                this.isNavigatingToGame = true;
                void this.router.navigate(['/game'], {
                    queryParams: {
                        room: payload.roomId,
                        gameId: this.currentGameId,
                        playerId: this.currentPlayerId,
                    },
                });
            }),
        );

        this.subscriptions.add(
            this.roomSocketService.error$.subscribe((error) => {
                this.notificationService.error(error.message);

                const normalizedMessage = error.message.toLowerCase();

                const shouldRedirectToHome =
                    normalizedMessage.includes('introuvable') ||
                    normalizedMessage.includes('deja commence') ||
                    normalizedMessage.includes('a deja commence');
                if (shouldRedirectToHome) {
                    this.chatSocketService.leaveRoom(this.currentRoomId);
                    this.currentRoomId = '';
                    this.clearRoomViewState();
                    void this.router.navigate(['/'], { replaceUrl: true });
                }
            }),
        );

        this.subscriptions.add(
            this.roomSocketService.cancelled$.subscribe((payload) => {
                this.chatSocketService.leaveRoom(this.currentRoomId);
                this.currentRoomId = '';
                this.clearRoomViewState();
                this.notificationService.warning(payload.message);
                void this.router.navigate(['/'], { replaceUrl: true });
            }),
        );

        this.subscriptions.add(
            this.roomSocketService.kicked$.subscribe((payload) => {
                this.chatSocketService.leaveRoom(this.currentRoomId);
                this.currentRoomId = '';
                this.clearRoomViewState();
                this.notificationService.warning(payload.message);
                void this.router.navigate(['/'], { replaceUrl: true });
            }),
        );
    }

    ngOnDestroy(): void {
        if (this.currentRoomId && !this.isNavigatingToGame) {
            this.roomSocketService.leave({ roomId: this.currentRoomId });
            this.chatSocketService.leaveRoom(this.currentRoomId);
        }
        this.subscriptions.unsubscribe();
    }

    isOrganizer(playerId: string): boolean {
        return this.room?.hostId === playerId;
    }

    isRoomLocked(): boolean {
        return this.room?.isLocked ?? false;
    }

    canStartGame(): boolean {
        return this.isCurrentUserHost && this.players.length >= 2;
    }

    startGame(): void {
        if (!this.currentRoomId || !this.canStartGame()) {
            return;
        }

        this.roomSocketService.start({
            roomId: this.currentRoomId,
        });
    }

    leaveRoom(): void {
        if (this.currentRoomId) {
            this.roomSocketService.leave({ roomId: this.currentRoomId });
            this.chatSocketService.leaveRoom(this.currentRoomId);
            this.currentRoomId = '';
        }

        this.clearRoomViewState();
        void this.router.navigate(['/'], { replaceUrl: true });
    }

    kickPlayer(playerId: string): void {
        if (!this.currentRoomId) {
            return;
        }

        this.roomSocketService.kick({
            roomId: this.currentRoomId,
            playerId,
        });
    }

    addVirtualPlayer(playstyle: Playstyle): void {
        if (!this.currentRoomId || !this.isCurrentUserHost) {
            return;
        }

        this.roomSocketService.addVirtualPlayer({
            roomId: this.currentRoomId,
            playstyle,
            playerAvatars: this.configService.getPlayerAvatars(),
        });
        this.showVirtualPlayerOptions = false;
    }

    getAvatarSrc(player: PlayerSummary): string {
        return player.avatar?.imageUrl ?? DEFAULT_AVATAR_IMAGE_URL;
    }

    isVirtualPlayer(player: PlayerSummary): player is VirtualPlayerSummary {
        return player.playerType === PlayerType.VirtualPlayer && 'playstyle' in player;
    }

    getVirtualPlayerLabel(player: PlayerSummary): string {
        if (!this.isVirtualPlayer(player)) {
            return '';
        }

        return player.playstyle === Playstyle.Defensive ? 'JV défensif' : 'JV agressif';
    }

    private clearRoomViewState(): void {
        this.room = null;
        this.players = [];
        this.maxPlayers = 0;
        this.currentGameId = '';
        this.currentPlayerId = '';
        this.showVirtualPlayerOptions = false;
        this.roomSocketService.resetRoomState();
    }

    private createDefaultCharacter(): PlayerCharacter {
        return {
            health: DEFAULT_HEALTH,
            maxHealth: DEFAULT_HEALTH,
            speed: DEFAULT_SPEED,
            attack: DEFAULT_ATTACK,
            defense: DEFAULT_DEFENSE,
            attackDice: 'D4',
            defenseDice: 'D6',
            movementPointsLeft: DEFAULT_SPEED,
            combatSanctuaryPointsLeft: 0,
            actionsLeft: 1,
        };
    }

    private updateCurrentPlayer(room: RoomState | null, pendingPlayerSetup?: PendingRoomPlayerSetup | null): void {
        if (!room) {
            this.currentPlayerId = '';
            return;
        }

        let currentPlayer: PlayerSummary | undefined;

        if (this.isCurrentUserHost) {
            currentPlayer = room.players.find((player) => player.id === room.hostId);
        } else if (this.currentPlayerId) {
            currentPlayer = room.players.find((player) => player.id === this.currentPlayerId);
        }

        if (!currentPlayer && pendingPlayerSetup) {
            currentPlayer = room.players.find((player) => player.avatar?.avatarName === pendingPlayerSetup.avatar.avatarName);
        }
        this.currentPlayerId = currentPlayer?.id ?? '';
        this.name = currentPlayer?.name ?? this.name;
    }

    private buildJoinPayload(): JoinRoomPayload {
        return {
            roomId: this.currentRoomId,
            name: this.pendingPlayerSetup?.name ?? this.name,
            avatar: this.pendingPlayerSetup?.avatar ?? {
                imageUrl: DEFAULT_AVATAR_IMAGE_URL,
                avatarName: AvatarName.Barbie,
            },
            playerType: this.pendingPlayerSetup?.playerType ?? PlayerType.HumanPlayer,
            character: this.pendingPlayerSetup?.character ?? this.createDefaultCharacter(),
        };
    }

    private tryJoinRoom(): void {
        if (!this.currentRoomId) {
            return;
        }

        const joinPayload = this.buildJoinPayload();
        this.roomSocketService.join(joinPayload);
    }
}
