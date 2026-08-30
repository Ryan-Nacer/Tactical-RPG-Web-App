import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CombatantStatsCardComponent } from '@app/components/combatant-stats-card/combatant-stats-card.component';
import { COMBAT_TURN_DURATION_SECONDS, CombatPosture, DEFENSIVE_POSTURE_DEFENSE_BONUS, OFFENSIVE_POSTURE_ATTACK_BONUS } from '@common/combat';

const DANGER_COUNTDOWN_THRESHOLD = 5;
const WARNING_COUNTDOWN_THRESHOLD = 10;
const SECONDS_PER_MINUTE = 60;

@Component({
    selector: 'app-combat-overlay',
    standalone: true,
    templateUrl: './combat-overlay.component.html',
    styleUrls: ['./combat-overlay.component.scss'],
    imports: [CommonModule, CombatantStatsCardComponent],
})
export class CombatOverlayComponent implements OnChanges {
    @Input() attackerName = 'Attaquant';
    @Input() defenderName = 'Defenseur';
    @Input() currentTurnNumber = 0;
    @Input() remainingSeconds = COMBAT_TURN_DURATION_SECONDS;
    @Input() attackerAvatarUrl = '';
    @Input() defenderAvatarUrl = '';
    @Input() attackerDiceResult = 0;
    @Input() attackerAttackBase = 0;
    @Input() attackerAttackPenalty = 0;
    @Input() attackerDefenseBase = 0;
    @Input() attackerDefensePenalty = 0;
    @Input() attackerDefenseDiceResult = 0;
    @Input() attackerHealth = 0;
    @Input() attackerMaxHealth = 0;
    @Input() defenderDiceResult = 0;
    @Input() defenderAttackBase = 0;
    @Input() defenderAttackPenalty = 0;
    @Input() defenderDefenseBase = 0;
    @Input() defenderDefensePenalty = 0;
    @Input() defenderDefenseDiceResult = 0;
    @Input() defenderHealth = 0;
    @Input() defenderMaxHealth = 0;
    @Input() attackerAttackPostureBonus = 0;
    @Input() attackerDefensePostureBonus = 0;
    @Input() defenderAttackPostureBonus = 0;
    @Input() defenderDefensePostureBonus = 0;
    @Input() attackerAttackTotal = 0;
    @Input() attackerDefenseTotal = 0;
    @Input() defenderAttackTotal = 0;
    @Input() defenderDefenseTotal = 0;
    @Input() attackerDamageTaken = 0;
    @Input() defenderDamageTaken = 0;
    @Input() isExiting = false;
    @Input() isCombatActive = true;

    @Output() postureSelected = new EventEmitter<CombatPosture>();

    readonly offensivePostureAttackBonus = OFFENSIVE_POSTURE_ATTACK_BONUS;
    readonly defensivePostureDefenseBonus = DEFENSIVE_POSTURE_DEFENSE_BONUS;

    selectedPosture: CombatPosture | null = null;

    get combatLabel(): string {
        return `${this.attackerName} vs ${this.defenderName}`;
    }

    get isSelectionClosed(): boolean {
        return this.remainingSeconds <= 0;
    }

    get formattedRemainingTime(): string {
        const minutes = Math.floor(this.remainingSeconds / SECONDS_PER_MINUTE)
            .toString()
            .padStart(2, '0');
        const seconds = (this.remainingSeconds % SECONDS_PER_MINUTE).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    get overlayTimerState(): 'combat' | 'warning' | 'danger' {
        if (this.remainingSeconds <= DANGER_COUNTDOWN_THRESHOLD) {
            return 'danger';
        }

        if (this.remainingSeconds <= WARNING_COUNTDOWN_THRESHOLD) {
            return 'warning';
        }

        return 'combat';
    }

    get attackerAttackResolution(): number {
        return this.attackerAttackTotal - this.defenderDefenseTotal;
    }

    get defenderAttackResolution(): number {
        return this.defenderAttackTotal - this.attackerDefenseTotal;
    }

    get attackerDamageDealt(): number {
        return Math.max(0, this.attackerAttackResolution);
    }

    get defenderDamageDealt(): number {
        return Math.max(0, this.defenderAttackResolution);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ('currentTurnNumber' in changes && !changes.currentTurnNumber.firstChange) {
            this.selectedPosture = null;
        }
    }

    choosePosture(posture: CombatPosture): void {
        if (this.isSelectionClosed) {
            return;
        }

        this.selectedPosture = posture;
        this.postureSelected.emit(posture);
    }

    isSelectedPosture(posture: CombatPosture): boolean {
        return this.selectedPosture === posture;
    }

    protected readonly combatPosture = CombatPosture;
}
