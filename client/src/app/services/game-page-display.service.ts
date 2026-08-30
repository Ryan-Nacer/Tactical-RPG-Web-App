import { Injectable } from '@angular/core';
import { GamePageCountdownState } from '@app/interfaces/game';
import { GameSessionCountdownMode, GameSessionPlayer } from '@common/game-session';

const SECONDS_PER_MINUTE = 60;
const DANGER_COUNTDOWN_THRESHOLD = 5;
const WARNING_COUNTDOWN_THRESHOLD = 10;

@Injectable({
    providedIn: 'root',
})
export class GamePageDisplayService {
    // REMPLACER PAR SWITCH CASE
    getCountdownState(countdownMode: GameSessionCountdownMode, countdownSeconds: number): GamePageCountdownState {
        if (countdownMode === 'disabled' || countdownMode === 'combat' || countdownMode === 'transition') {
            return countdownMode;
        }

        if (countdownSeconds <= DANGER_COUNTDOWN_THRESHOLD) {
            return 'danger';
        }

        if (countdownSeconds <= WARNING_COUNTDOWN_THRESHOLD) {
            return 'warning';
        }

        return 'normal';
    }

    getCountdownLabel(countdownMode: GameSessionCountdownMode): string {
        switch (countdownMode) {
            case 'transition':
                return 'Prochain tour';
            case 'combat':
                return 'Tour de combat';
            case 'disabled':
                return 'Compte a rebours';
            default:
                return 'Temps restant';
        }
    }

    getCountdownContextLabel(countdownMode: GameSessionCountdownMode, activePlayer: GameSessionPlayer | null): string {
        const activePlayerName = activePlayer?.name ?? 'personne';

        // REMPLACER PAR SWITCH CASE
        if (countdownMode === 'disabled') {
            return 'Combat en cours';
        }

        if (countdownMode === 'combat') {
            return `Combat de ${activePlayerName}`;
        }

        if (countdownMode === 'transition') {
            return `Le tour de ${activePlayerName} commence bientot`;
        }

        return `Tour de ${activePlayerName}`;
    }

    formatCountdownValue(countdownMode: GameSessionCountdownMode, countdownSeconds: number): string {
        if (countdownMode === 'disabled') {
            return '--';
        }

        const minutes = Math.floor(countdownSeconds / SECONDS_PER_MINUTE)
            .toString()
            .padStart(2, '0');
        const seconds = (countdownSeconds % SECONDS_PER_MINUTE).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    formatMessageTime(createdAt: string): string {
        const date = new Date(createdAt);
        if (Number.isNaN(date.getTime())) {
            return '--:--:--';
        }

        return date.toLocaleTimeString('fr-CA', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    }
}
