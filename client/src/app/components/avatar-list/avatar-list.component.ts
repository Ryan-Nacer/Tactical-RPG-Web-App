import { Component, effect, EventEmitter, input, OnInit, Output, OnDestroy } from '@angular/core';
import { PlayerCardComponent } from '@app/components/player-card/player-card.component';
import { ConfigService } from '@app/services/config.service';
import { PlayerAvatar } from '@common/player';

const INTERVAL_DELAY = 100;
const VISIBLE_CHARACTERS_COUNT = 5;
const HALF_VISIBLE_CHARACTERS_COUNT = Math.floor(VISIBLE_CHARACTERS_COUNT / 2);

@Component({
    selector: 'app-avatar-list',
    imports: [PlayerCardComponent],
    templateUrl: './avatar-list.component.html',
    styleUrls: ['./avatar-list.component.scss'],
})
export class AvatarListComponent implements OnInit, OnDestroy {
    // liste des avatars de joueurs predefinis
    playerAvatars: PlayerAvatar[] = [];
    currentAvatarIndex: number = 0;
    visibleAvatars: PlayerAvatar[] = [];
    private intervalId: ReturnType<typeof setInterval> | undefined;

    @Output() avatarSelected = new EventEmitter<{ avatar: PlayerAvatar; visibleIndex: number; isCenter: boolean }>();
    randomAvatarIndex = input(0);

    constructor(private configService: ConfigService) {
        effect(() => {
            const randomIndex = this.randomAvatarIndex();

            if (this.playerAvatars.length > 0) {
                this.currentAvatarIndex = randomIndex;
                this.updateVisibleAvatars();
                const selectedAvatar = this.playerAvatars[this.currentAvatarIndex];
                this.avatarSelected.emit({
                    avatar: selectedAvatar,
                    visibleIndex: HALF_VISIBLE_CHARACTERS_COUNT,
                    isCenter: true,
                });
            }
        });
    }

    ngOnInit(): void {
        this.intervalId = setInterval(() => {
            if (this.configService.isLoaded) {
                this.playerAvatars = this.configService.getPlayerAvatars();
                this.updateVisibleAvatars();
                clearInterval(this.intervalId);
            }
        }, INTERVAL_DELAY);
    }

    prevAvatar(): void {
        this.currentAvatarIndex = (this.currentAvatarIndex - 1 + this.playerAvatars.length) % this.playerAvatars.length;
        this.updateVisibleAvatars();
    }
    nextAvatar(): void {
        this.currentAvatarIndex = (this.currentAvatarIndex + 1) % this.playerAvatars.length;
        this.updateVisibleAvatars();
    }

    updateVisibleAvatars(): void {
        this.visibleAvatars = [];

        for (let i = -HALF_VISIBLE_CHARACTERS_COUNT; i <= HALF_VISIBLE_CHARACTERS_COUNT; i++) {
            const index = (this.currentAvatarIndex + i + this.playerAvatars.length) % this.playerAvatars.length;
            this.visibleAvatars.push(this.playerAvatars[index]);
        }
    }

    isActive(index: number): boolean {
        return index === HALF_VISIBLE_CHARACTERS_COUNT;
    }

    sendChoice(playerAvatar: PlayerAvatar, visibleIndex: number): void {
        const isCenter = this.isActive(visibleIndex);
        this.avatarSelected.emit({ avatar: playerAvatar, visibleIndex, isCenter });

        if (!isCenter) {
            this.currentAvatarIndex =
                (this.currentAvatarIndex + visibleIndex - HALF_VISIBLE_CHARACTERS_COUNT + this.playerAvatars.length) % this.playerAvatars.length;
            this.updateVisibleAvatars();
        }
    }

    getActiveAvatar(): PlayerAvatar {
        return this.playerAvatars[this.currentAvatarIndex];
    }

    ngOnDestroy(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
}
