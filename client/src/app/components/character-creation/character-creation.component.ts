import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AvatarListComponent } from '@app/components/avatar-list/avatar-list.component';
import { ConfigService } from '@app/services/config.service';
import { PlayerAvatar } from '@common/player';


const DEFAULT_LIFE_VALUE = 6;
const DEFAULT_SPEED_VALUE = 6;
const DEFAULT_ATTACK_VALUE = 4;
const DEFAULT_DEFENSE_VALUE = 4;
const BONUS_VALUE = 2;
const RANDOM_PROBABILITY = 0.5;

@Component({
    selector: 'app-character-creation',
    standalone: true,
    imports: [CommonModule, FormsModule, AvatarListComponent],
    templateUrl: './character-creation.component.html',
    styleUrls: ['./character-creation.component.scss'],
})
export class CharacterCreationComponent {
    selectedAvatar: PlayerAvatar | null = null;
    randomAvatarIndex = signal(0);

    name = '';

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

    constructor(
        private configService: ConfigService,
        private router: Router,
    ) {}

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
        if (avatars.length > 0) {
            const randomIndex = Math.floor(Math.random() * avatars.length);
            this.randomAvatarIndex.set(randomIndex);
        }

        const bonus = Math.random() < RANDOM_PROBABILITY ? 'life' : 'speed';
        this.applyBonus(bonus);

        const dice = Math.random() < RANDOM_PROBABILITY ? 'D4' : 'D6';
        this.assignDice(dice);
    }

    onAvatarSelected(event: { avatar: PlayerAvatar; visibleIndex: number; isCenter: boolean }): void {
        if (event.isCenter) {
            this.selectedAvatar = event.avatar;
            this.name = event.avatar.avatarName;
        }
    }

    saveAvatarChoice(): void {
        if (!this.selectedAvatar) {
            return;
        }
        this.router.navigate(['/wait']);
    }

    get bonusAttributeLabel() {
        if (this.bonusAttribute === 'life') return 'Vie';
        if (this.bonusAttribute === 'speed') return 'Rapidité';
        return '';
    }
}
