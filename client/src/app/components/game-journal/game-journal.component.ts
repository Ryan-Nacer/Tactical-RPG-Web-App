import { Component, Input, inject } from '@angular/core';
import { GamePageStateService } from '@app/services/game-page-state.service';
import { GamePageDisplayService } from '@app/services/game-page-display.service';
import { GameSessionMessage, GameSessionPlayer } from '@common/game-session';

@Component({
    selector: 'app-game-journal',
    standalone: true,
    templateUrl: './game-journal.component.html',
    styleUrl: './game-journal.component.scss',
})
export class GameJournalComponent {
    @Input() messages: GameSessionMessage[] = [];
    @Input() players: GameSessionPlayer[] = [];

    readonly gamePageStateService = inject(GamePageStateService);
    readonly gamePageDisplayService = inject(GamePageDisplayService);
}

/*import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { GamePageDisplayService } from '@app/services/game-page-display.service';
import { GamePageStateService } from '@app/services/game-page-state.service';
import { GameSessionMessage } from '@common/game-session';

@Component({
  selector: 'app-game-journal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-journal.component.html',
  styleUrl: './game-journal.component.scss',
})
export class GameJournalComponent {

  @Input() messages: GameSessionMessage[] = [];

  readonly gamePageStateService = inject(GamePageStateService);
  readonly gamePageDisplayService = inject(GamePageDisplayService);


}*/

/**
 * ce composany doit :
 *  Afficher la liste de messages
 *  Formater l'heure
 * distinguer systeme / action
 * afficher vide si rien
 */
