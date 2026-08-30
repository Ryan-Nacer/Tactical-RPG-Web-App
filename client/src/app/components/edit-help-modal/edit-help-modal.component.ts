import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
    selector: 'app-edit-help-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './edit-help-modal.component.html',
    styleUrls: ['./edit-help-modal.component.scss'],
})
export class EditHelpModalComponent {
    @Input() isOpen = false;
    @Output() closeRequested = new EventEmitter<void>();

    requestClose(): void {
        this.closeRequested.emit();
    }
}
