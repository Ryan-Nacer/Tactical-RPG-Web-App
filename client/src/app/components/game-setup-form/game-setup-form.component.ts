import { CommonModule } from '@angular/common';
import { Component, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface GameSetupData {
    mode: 'CLASSIC' | 'CTF';
    size: '10' | '15' | '20';
}

@Component({
    selector: 'app-game-setup-form',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './game-setup-form.component.html',
    styleUrl: './game-setup-form.component.scss',
})
export class GameSetupFormComponent {
    @Output() formSubmitted = new EventEmitter<GameSetupData>();

    mode: 'CLASSIC' | 'CTF' = 'CLASSIC';
    size: '10' | '15' | '20' = '10';

    submit(): void {
        this.formSubmitted.emit({ mode: this.mode, size: this.size });
    }
}
