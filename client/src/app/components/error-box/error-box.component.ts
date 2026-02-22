import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
    selector: 'app-error-box',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './error-box.component.html',
    styleUrls: ['./error-box.component.scss'],
})
export class ErrorBoxComponent {
    @Input() errors: string[] = [];
}
