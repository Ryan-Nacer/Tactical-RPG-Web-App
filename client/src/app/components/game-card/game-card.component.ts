import { Component, Input } from '@angular/core';
import { Game } from '@common/game';

@Component({
    selector: 'app-game-card',
    imports: [],
    templateUrl: './game-card.component.html',
    styleUrl: './game-card.component.scss',
})
export class GameCardComponent {
    @Input() game: Game;
}
