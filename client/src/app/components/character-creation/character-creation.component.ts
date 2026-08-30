import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AvatarListComponent } from '@app/components/avatar-list/avatar-list.component';
import { ConfigService } from '@app/services/config.service';
import { RoomSocketService } from '@app/services/room-socket.service';
import { GridSize } from '@common/game';
import { AvatarName, PlayerAvatar, PlayerType } from '@common/player';
import { CreateRoomPayload, PlayerCharacter } from '@common/wait-room';
import { filter, Subscription, take } from 'rxjs';

const DEFAULT_LIFE_VALUE = 6;
const DEFAULT_SPEED_VALUE = 6;
const DEFAULT_ATTACK_VALUE = 4;
const DEFAULT_DEFENSE_VALUE = 4;
const BONUS_VALUE = 2;
const RANDOM_PROBABILITY = 0.5;
const HOME_REDIRECT_NOTICE_KEY = 'home-redirect-notice';
const HOME_REDIRECT_NOTICE_LEVEL_KEY = 'home-redirect-notice-level';
const HOST_LEFT_NOTICE = "L'organisateur a quitté la salle.";

@Component({
    selector: 'app-character-creation',
    standalone: true,
    imports: [CommonModule, FormsModule, AvatarListComponent],
    templateUrl: './character-creation.component.html',
    styleUrls: ['./character-creation.component.scss'],
})
export class CharacterCreationComponent implements OnInit, OnDestroy {
    selectedAvatar: PlayerAvatar | null = null;
    randomAvatarIndex = signal(0);

    name = '';
    isHost = false;
    gameId = '';
    roomId = '';
    gameName = '';
    gameMode = '';
    gridSize: GridSize | null = null;
    takenAvatars: AvatarName[] = [];
    avatarAvailabilityMessage = '';

    private hasClickedJoin = false;
    showLockedRoomPopup = false;
    errorMessage = '';
    private pendingReservedAvatarName: AvatarName | null = null;

    private readonly subscriptions = new Subscription();

    attributes = {
        life: DEFAULT_LIFE_VALUE,
        speed: DEFAULT_SPEED_VALUE,
        attack: DEFAULT_ATTACK_VALUE,
        defense: DEFAULT_DEFENSE_VALUE,
    };

    bonusAttribute: 'life' | 'speed' | null = null;

    dice = {
        attack: 'D4' as 'D4' | 'D6',
        defense: 'D6' as 'D4' | 'D6',
    };

    private readonly configService = inject(ConfigService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly roomSocketService = inject(RoomSocketService);

    ngOnInit(): void {
        const queryParams = this.route.snapshot.queryParamMap;

        this.isHost = queryParams.get('host') === 'true';
        this.gameId = queryParams.get('gameId') ?? '';
        this.roomId = queryParams.get('room') ?? '';
        this.gameName = queryParams.get('gameName') ?? '';
        this.gameMode = queryParams.get('mode') ?? '';

        const gridSizeParam = queryParams.get('gridSize');
        this.gridSize = gridSizeParam ? (Number(gridSizeParam) as GridSize) : null;

        if (!this.isHost && this.roomId) {
            this.subscriptions.add(
                this.roomSocketService.takenAvatars$.subscribe((payload) => {
                    if (!payload || payload.roomId !== this.roomId) {
                        return;
                    }
                    this.takenAvatars = payload.avatars;
                    if (this.pendingReservedAvatarName && payload.avatars.includes(this.pendingReservedAvatarName)) {
                        this.pendingReservedAvatarName = null;
                    }
                }),
            );

            this.roomSocketService.requestTakenAvatars({
                roomId: this.roomId,
            });
        }

        this.subscriptions.add(
            this.roomSocketService.roomState$
                .pipe(
                    filter((room) => !!room && !this.isHost && this.hasClickedJoin),
                    take(1),
                )
                .subscribe((room) => {
                    this.router.navigate(['/wait'], {
                        queryParams: {
                            room: room?.roomId,
                            name: this.name,
                            gameId: this.gameId,
                            host: false,
                        },
                    });
                }),
        );

        this.subscriptions.add(
            this.roomSocketService.error$.subscribe((error) => {
                const normalizedMessage = error.message.toLowerCase();

                if (normalizedMessage.includes('verrou')) {
                    this.errorMessage = 'La salle est verrouillée. Voulez-vous réessayer ou retourner à la vue initiale ?';
                    this.showLockedRoomPopup = true;
                    return;
                }

                if (normalizedMessage.includes('avatar indisponible')) {
                    this.handleUnavailableAvatarError();
                    return;
                }

                const shouldRedirectToHome =
                    normalizedMessage.includes('introuvable') ||
                    normalizedMessage.includes('deja commence') ||
                    normalizedMessage.includes('a deja commence');
                if (shouldRedirectToHome) {
                    const shouldExplainHostLeft = !this.isHost && this.hasClickedJoin && normalizedMessage.includes('introuvable');
                    this.goBack(shouldExplainHostLeft ? HOST_LEFT_NOTICE : undefined);
                }
            }),
        );

        this.subscriptions.add(
            this.roomSocketService.cancelled$.subscribe((payload) => {
                this.goBack(payload.message || HOST_LEFT_NOTICE);
            }),
        );
    }

    applyBonus(attribute: 'life' | 'speed') {
        this.attributes.life = DEFAULT_LIFE_VALUE;
        this.attributes.speed = DEFAULT_SPEED_VALUE;

        this.attributes[attribute] += BONUS_VALUE;
        this.bonusAttribute = attribute;
    }

    assignDice(dice: 'D4' | 'D6') {
        this.dice.attack = dice;
        this.dice.defense = dice === 'D4' ? 'D6' : 'D4';
    }

    generateRandomCharacter() {
        const avatars = this.configService.getPlayerAvatars();

        const availableAvatars = avatars.filter((avatar) => !this.takenAvatars.includes(avatar.avatarName));

        if (availableAvatars.length === 0) {
            return;
        }

        const randomIndex = Math.floor(Math.random() * availableAvatars.length);
        const randomAvatar = availableAvatars[randomIndex];
        const previousAvatarName = this.selectedAvatar?.avatarName;
        this.selectedAvatar = randomAvatar;

        if (this.shouldSyncNameWithAvatar(previousAvatarName)) {
            this.name = randomAvatar.avatarName;
        }

        const originalIndex = avatars.findIndex((avatar) => avatar.avatarName === randomAvatar.avatarName);

        this.randomAvatarIndex.set(originalIndex);

        const bonus = Math.random() < RANDOM_PROBABILITY ? 'life' : 'speed';
        this.applyBonus(bonus);

        const dice = Math.random() < RANDOM_PROBABILITY ? 'D4' : 'D6';
        this.assignDice(dice);
    }

    onAvatarSelected(event: { avatar: PlayerAvatar; visibleIndex: number } | null): void {
        if (!event) {
            if (this.selectedAvatar && !this.isHost && this.roomId) {
                this.roomSocketService.releaseTemporaryAvatar({ roomId: this.roomId });
            }

            this.pendingReservedAvatarName = null;
            this.avatarAvailabilityMessage = '';
            this.selectedAvatar = null;
            return;
        }

        if (!this.isHost && this.roomId && this.selectedAvatar && this.selectedAvatar.avatarName !== event.avatar.avatarName) {
            this.roomSocketService.releaseTemporaryAvatar({ roomId: this.roomId });
        }

        if (!this.isHost && this.roomId) {
            this.pendingReservedAvatarName = event.avatar.avatarName;
            this.roomSocketService.reserveTemporaryAvatar({ roomId: this.roomId, avatar: event.avatar.avatarName });
        }

        const previousAvatarName = this.selectedAvatar?.avatarName;
        this.selectedAvatar = event.avatar;
        this.avatarAvailabilityMessage = '';

        if (this.shouldSyncNameWithAvatar(previousAvatarName)) {
            this.name = event.avatar.avatarName;
        }
    }

    private shouldSyncNameWithAvatar(previousAvatarName?: AvatarName): boolean {
        return !this.name || this.name === previousAvatarName;
    }

    private handleUnavailableAvatarError(): void {
        this.avatarAvailabilityMessage = "Cet avatar vient d'etre pris. Veuillez en choisir un autre.";
        this.pendingReservedAvatarName = null;
        this.selectedAvatar = null;

        if (this.roomId) {
            this.roomSocketService.requestTakenAvatars({ roomId: this.roomId });
        }
    }

    saveAvatarChoice(): void {
        if (!this.selectedAvatar) {
            return;
        }
        const playerName = this.name.trim() || this.selectedAvatar?.avatarName;
        const character = this.buildPlayerCharacter();

        this.roomSocketService.setPendingPlayerSetup({
            name: playerName,
            avatar: this.selectedAvatar,
            playerType: PlayerType.HumanPlayer,
            character,
        });

        if (this.isHost) {
            this.handleHostSave(playerName, character, this.selectedAvatar);
            return;
        }

        this.hasClickedJoin = true;

        this.roomSocketService.join({
            roomId: this.roomId,
            name: playerName,
            avatar: this.selectedAvatar,
            playerType: PlayerType.HumanPlayer,
            character,
        });

        /*
        this.router.navigate(['/wait'], {
            queryParams: {
                room: this.roomId,
                name: playerName,
                gameId: this.gameId,
                host: this.isHost,
            },
        });*/
    }

    private handleHostSave(playerName: string, character: PlayerCharacter, avatar: PlayerAvatar): void {
        if (!this.gridSize || !this.gameId) {
            return;
        }

        const createPayload: CreateRoomPayload = {
            name: playerName,
            avatar,
            playerType: PlayerType.HumanPlayer,
            character,
            gameId: this.gameId,
            gridSize: this.gridSize,
            gameName: this.gameName,
            mode: this.gameMode,
        };

        this.roomSocketService.resetRoomState();

        this.roomSocketService.roomState$
            .pipe(
                filter((room): room is NonNullable<typeof room> => !!room),
                filter((room) => room.hostId === this.roomSocketService.socketId),
                take(1),
            )
            .subscribe((room) => {
                this.router.navigate(['/wait'], {
                    queryParams: {
                        room: room.roomId,
                        name: playerName,
                        gameId: this.gameId,
                        host: true,
                    },
                });
            });

        this.roomSocketService.create(createPayload);
    }

    private buildPlayerCharacter(): PlayerCharacter {
        return {
            health: this.attributes.life,
            maxHealth: this.attributes.life,
            speed: this.attributes.speed,
            attack: this.attributes.attack,
            defense: this.attributes.defense,
            attackDice: this.dice.attack,
            defenseDice: this.dice.defense,
            movementPointsLeft: this.attributes.speed,
            combatSanctuaryPointsLeft: 0,
            actionsLeft: 1,
        };
    }

    get bonusAttributeLabel() {
        if (this.bonusAttribute === 'life') return 'Vie';
        if (this.bonusAttribute === 'speed') return 'Rapidité';
        return '';
    }

    retryJoin(): void {
        this.showLockedRoomPopup = false;

        // relancer join
        this.saveAvatarChoice();
    }

    goBack(message?: string): void {
        this.showLockedRoomPopup = false;
        if (message) {
            sessionStorage.setItem(HOME_REDIRECT_NOTICE_KEY, message);
            sessionStorage.setItem(HOME_REDIRECT_NOTICE_LEVEL_KEY, 'warning');
        }
        this.router.navigate(['/']);
    }

    ngOnDestroy(): void {
        if (!this.isHost && this.roomId && this.selectedAvatar) {
            this.roomSocketService.releaseTemporaryAvatar({ roomId: this.roomId });
        }

        this.subscriptions.unsubscribe();
    }
}
