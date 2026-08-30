import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { ChatZoneComponent } from '@app/components/chat-zone/chat-zone.component';
import { CombatOverlayComponent } from '@app/components/combat-overlay/combat-overlay.component';
import { CombatResultMessageComponent } from '@app/components/combat-result-message/combat-result-message.component';
import { GameGridComponent } from '@app/components/game-grid/game-grid.component';
import { GameHelpModalComponent } from '@app/components/game-help-modal/game-help-modal.component';
import { GameJournalComponent } from '@app/components/game-journal/game-journal.component';
import { GamePageComponentLifecycle } from './game-page.component.lifecycle';

@Component({
    selector: 'app-game-page',
    standalone: true,
    templateUrl: './game-page.component.html',
    styleUrls: ['./game-page.component.scss'],
    imports: [
        CommonModule,
        GameGridComponent,
        ChatZoneComponent,
        GameJournalComponent,
        CombatOverlayComponent,
        CombatResultMessageComponent,
        GameHelpModalComponent,
    ],
})
export class GamePageComponent extends GamePageComponentLifecycle {
    @ViewChild('playersListContainer') private playersListContainer?: ElementRef<HTMLDivElement>;
    private lastAutoScrolledActivePlayerId: string | null = null;

    @HostListener('window:beforeunload')
    onBeforeUnload(): void {
        this.handleBeforeUnload();
    }

    @HostListener('document:keydown.escape')
    onEscapePressed(): void {
        this.handleEscapePressed();
    }

    @HostListener('document:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent): void {
        this.handleKeyUp(event);
    }

    @HostListener('document:keydown', ['$event'])
    onDebugShortcutPressed(event: KeyboardEvent): void {
        this.handleDebugShortcutPressed(event);
    }

    protected scheduleScrollToActivePlayer(): void {
        const activePlayerId = this.activePlayer?.id;
        if (!activePlayerId || this.lastAutoScrolledActivePlayerId === activePlayerId) {
            return;
        }

        this.lastAutoScrolledActivePlayerId = activePlayerId;
        setTimeout(() => this.scrollActivePlayerIntoView(), 0);
    }

    private scrollActivePlayerIntoView(): void {
        const list = this.playersListContainer?.nativeElement;
        if (!list) {
            return;
        }

        const activeRow = list.querySelector<HTMLElement>('.player-row.active');
        if (!activeRow) {
            return;
        }

        activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}
