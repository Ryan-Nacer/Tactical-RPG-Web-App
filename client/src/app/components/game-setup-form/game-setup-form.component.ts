import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameSetupData } from '@app/interfaces/game';
import { GridSize, Mode } from '@common/game';

@Component({
    selector: 'app-game-setup-form',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './game-setup-form.component.html',
    styleUrl: './game-setup-form.component.scss',
})
export class GameSetupFormComponent {
    readonly modeEnum = Mode;
    readonly gridSizeEnum = GridSize;

    @Output() formSubmitted = new EventEmitter<GameSetupData>();

    mode: Mode = Mode.Classic;
    size: GridSize = GridSize.Small;

    submit(): void {
        this.formSubmitted.emit({ mode: this.mode, size: this.size });
    }
}
