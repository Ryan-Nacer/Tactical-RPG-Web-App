import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-combatant-stats-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './combatant-stats-card.component.html',
    styleUrls: ['./combatant-stats-card.component.scss'],
})
export class CombatantStatsCardComponent {
    @Input() name = '';
    @Input() avatarUrl = '';
    @Input() avatarAlt = '';
    @Input() defaultAvatarUrl = 'assets/characters/barbie.png';

    @Input() health = 0;
    @Input() maxHealth = 0;
    @Input() damageTaken = 0;
    @Input() damageDealt = 0;

    @Input() attackBase = 0;
    @Input() defenseBase = 0;
    @Input() attackDiceResult = 0;
    @Input() defenseDiceResult = 0;
    @Input() attackPostureBonus = 0;
    @Input() defensePostureBonus = 0;
    @Input() attackPenalty = 0;
    @Input() defensePenalty = 0;
    @Input() attackTotal = 0;
    @Input() defenseTotal = 0;

    formatPenalty(value: number): string {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue) || numericValue === 0) {
            return '0';
        }

        return `-${Math.abs(numericValue)}`;
    }
}
