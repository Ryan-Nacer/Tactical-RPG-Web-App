import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-game-help-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './game-help-modal.component.html',
    styleUrls: ['./game-help-modal.component.scss'],
})
export class GameHelpModalComponent {
    @Input() isOpen = false;
    @Output() closeRequested = new EventEmitter<void>();

    requestClose(): void {
        this.closeRequested.emit();
    }
}
