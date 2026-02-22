import { Component, Input } from '@angular/core';
import { AvatarName } from '@common/player';

@Component({
    selector: 'app-player-card',
    imports: [],
    templateUrl: './player-card.component.html',
    styleUrl: './player-card.component.scss',
})
export class PlayerCardComponent {
    // injection de l'image par le composant parent
    @Input() imageUrl: string = '';
    @Input() avatarName: AvatarName;
}
