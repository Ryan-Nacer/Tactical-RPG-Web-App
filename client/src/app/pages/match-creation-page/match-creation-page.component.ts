import { Component, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { GameClientService } from '@app/services/game-client.service';
import { GameSocketService } from '@app/services/game-socket.service';
import { Game } from '@common/game';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-match-creation-page',
    imports: [GameCardComponent, RouterLink],
    templateUrl: './match-creation-page.component.html',
    styleUrl: './match-creation-page.component.scss',
})
export class MatchCreationPageComponent implements OnDestroy {
    visibleGames: Game[] = [];
    private readonly destroy$ = new Subject<void>();

    constructor(
        private gameClientService: GameClientService,
        private gameSocketService: GameSocketService,
    ) {
        this.getAllVisibleGames();

        this.gameSocketService.gameListUpdated$.pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.getAllVisibleGames();
        });
    }

    getAllVisibleGames(): void {
        this.gameClientService.getVisibleGames().subscribe({
            next: (games) => {
                this.visibleGames = games;
            },
            error: (error) => {
                throw new Error(error);
            },
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
