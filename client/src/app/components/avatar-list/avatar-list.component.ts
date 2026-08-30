import { Component, effect, EventEmitter, input, OnDestroy, OnInit, Output } from '@angular/core';
import { PlayerCardComponent } from '@app/components/player-card/player-card.component';
import { ConfigService } from '@app/services/config.service';
import { AvatarName, PlayerAvatar } from '@common/player';
import { AVATAR_LIST_HALF_VISIBLE_CHARACTERS_COUNT, AVATAR_LIST_INTERVAL_DELAY } from './avatar-list.constants';

@Component({
    selector: 'app-avatar-list',
    imports: [PlayerCardComponent],
    templateUrl: './avatar-list.component.html',
    styleUrls: ['./avatar-list.component.scss'],
})
export class AvatarListComponent implements OnInit, OnDestroy {
    private playerAvatars: PlayerAvatar[] = [];
    private currentAvatarIndex: number = 0;
    visibleAvatars: PlayerAvatar[] = [];

    private intervalId: ReturnType<typeof setInterval> | undefined;

    @Output() avatarSelected = new EventEmitter<{ avatar: PlayerAvatar; visibleIndex: number } | null>();
    randomAvatarIndex = input(0);
    takenAvatars = input<AvatarName[]>([]);
    selectedAvatarName = input<AvatarName | null>(null);

    constructor(private readonly configService: ConfigService) {
        effect(() => {
            const randomIndex = this.randomAvatarIndex();

            if (this.playerAvatars.length > 0) {
                this.currentAvatarIndex = randomIndex;
                this.updateVisibleAvatars();
                this.emitCenteredAvatarSelection();
            }
        });
    }

    ngOnInit(): void {
        this.intervalId = setInterval(() => {
            if (this.configService.isLoaded) {
                this.playerAvatars = this.configService.getPlayerAvatars();
                this.updateVisibleAvatars();
                this.emitCenteredAvatarSelection();
                clearInterval(this.intervalId);
            }
        }, AVATAR_LIST_INTERVAL_DELAY);
    }

    prevAvatar(): void {
        if (this.playerAvatars.length === 0) {
            return;
        }

        this.currentAvatarIndex = this.findNextAvailableIndex(-1);
        this.updateVisibleAvatars();
        this.emitCenteredAvatarSelection();
    }

    nextAvatar(): void {
        if (this.playerAvatars.length === 0) {
            return;
        }

        this.currentAvatarIndex = this.findNextAvailableIndex(1);
        this.updateVisibleAvatars();
        this.emitCenteredAvatarSelection();
    }

    updateVisibleAvatars(): void {
        this.visibleAvatars = [];

        for (let i = -AVATAR_LIST_HALF_VISIBLE_CHARACTERS_COUNT; i <= AVATAR_LIST_HALF_VISIBLE_CHARACTERS_COUNT; i++) {
            const index = (this.currentAvatarIndex + i + this.playerAvatars.length) % this.playerAvatars.length;
            this.visibleAvatars.push(this.playerAvatars[index]);
        }
    }

    isActive(index: number): boolean {
        return index === AVATAR_LIST_HALF_VISIBLE_CHARACTERS_COUNT;
    }

    private emitCenteredAvatarSelection(): void {
        const centeredAvatar = this.visibleAvatars[AVATAR_LIST_HALF_VISIBLE_CHARACTERS_COUNT];
        if (!centeredAvatar || this.isTakenByOther(centeredAvatar)) {
            this.avatarSelected.emit(null);
            return;
        }

        this.avatarSelected.emit({
            avatar: centeredAvatar,
            visibleIndex: AVATAR_LIST_HALF_VISIBLE_CHARACTERS_COUNT,
        });
    }

    sendChoice(playerAvatar: PlayerAvatar, visibleIndex: number): void {
        if (this.isTakenByOther(playerAvatar)) {
            return;
        }
        const isCenter = this.isActive(visibleIndex);
        this.avatarSelected.emit({ avatar: playerAvatar, visibleIndex });

        if (!isCenter) {
            this.currentAvatarIndex =
                (this.currentAvatarIndex + visibleIndex - AVATAR_LIST_HALF_VISIBLE_CHARACTERS_COUNT + this.playerAvatars.length) %
                this.playerAvatars.length;
            this.updateVisibleAvatars();
        }
    }

    getActiveAvatar(): PlayerAvatar {
        return this.playerAvatars[this.currentAvatarIndex];
    }

    isAvatarTaken(playerAvatar: PlayerAvatar): boolean {
        for (const name of this.takenAvatars()) {
            if (playerAvatar.avatarName === name) {
                return true;
            }
        }
        return false;
    }

    isTakenByOther(playerAvatar: PlayerAvatar): boolean {
        return this.isAvatarTaken(playerAvatar) && this.selectedAvatarName() !== playerAvatar.avatarName;
    }

    private findNextAvailableIndex(direction: -1 | 1): number {
        for (let offset = 1; offset <= this.playerAvatars.length; offset++) {
            const index = (this.currentAvatarIndex + direction * offset + this.playerAvatars.length) % this.playerAvatars.length;
            if (!this.isTakenByOther(this.playerAvatars[index])) {
                return index;
            }
        }

        return this.currentAvatarIndex;
    }

    ngOnDestroy(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }
}
