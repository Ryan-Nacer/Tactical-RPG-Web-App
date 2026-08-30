import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-combat-result-message',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './combat-result-message.component.html',
    styleUrls: ['./combat-result-message.component.scss'],
})
export class CombatResultMessageComponent {
    @Input() currentPlayerId = '';
    @Input() winnerPlayerId = '';
    @Input() winnerPlayerName = '';
    @Input() isGameWinner = false;
    @Input() isTie = false;
    @Output() closeRequested = new EventEmitter<void>();

    get isWinner(): boolean {
        return !this.isTie && this.currentPlayerId !== '' && this.currentPlayerId === this.winnerPlayerId;
    }

    get isNeutral(): boolean {
        return this.isTie;
    }

    get message(): string {
        if (this.isTie) {
            return 'Le combat se termine par une egalite.';
        }

        const winnerName = this.winnerPlayerName || 'Un joueur';

        if (this.isWinner) {
            return this.isGameWinner ? 'Vous avez gagne la partie.' : 'Vous avez remporte le combat.';
        }

        return this.isGameWinner ? `${winnerName} a gagne la partie.` : `${winnerName} a remporte le combat.`;
    }

    requestClose(): void {
        this.closeRequested.emit();
    }
}
