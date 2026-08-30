import { CommonModule } from '@angular/common';
import { HttpStatusCode } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { GameSetupFormComponent } from '@app/components/game-setup-form/game-setup-form.component';
import { GameSetupData } from '@app/interfaces/game';
import { ERROR_MESSAGES } from '@app/pages/pages.constants';
import { GameClientService } from '@app/services/game-client.service';
import { GameSocketService } from '@app/services/game-socket.service';
import { NotificationService } from '@app/services/notifications/notification.service';
import { Game } from '@common/game';
import { EMPTY, Subject, catchError, startWith, switchMap, takeUntil, tap } from 'rxjs';

@Component({
    selector: 'app-admin-page',
    standalone: true,
    imports: [RouterLink, CommonModule, GameSetupFormComponent, GameCardComponent],
    templateUrl: './admin-page.component.html',
    styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent implements OnInit, OnDestroy {
    games: Game[] = [];
    showCreateForm = false;
    isLoading = true;
    pendingDeletionGame: Game | null = null;
    private readonly destroySubject = new Subject<void>();
    private readonly reloadGamesSubject = new Subject<void>();
    private readonly notificationService = inject(NotificationService);
    private readonly gameClientService = inject(GameClientService);
    private readonly gameSocketService = inject(GameSocketService);
    private readonly router = inject(Router);

    ngOnInit(): void {
        this.reloadGamesSubject
            .pipe(
                startWith(void 0),
                switchMap(() =>
                    this.gameClientService.getAllGames().pipe(
                        tap((games: Game[]) => {
                            this.games = games;
                            this.isLoading = false;
                        }),
                        catchError(() => {
                            this.isLoading = false;
                            this.notificationService.error(ERROR_MESSAGES.loadGamesError);
                            return EMPTY;
                        }),
                    ),
                ),
                takeUntil(this.destroySubject),
            )
            .subscribe();

        this.gameSocketService.gameListUpdated$.pipe(takeUntil(this.destroySubject)).subscribe(() => {
            this.reloadGames();
        });
    }

    private reloadGames(): void {
        this.isLoading = true;
        this.reloadGamesSubject.next();
    }

    requestDeleteGame(game: Game): void {
        this.pendingDeletionGame = game;
    }

    closeDeleteConfirmation(): void {
        this.pendingDeletionGame = null;
    }

    confirmDeleteGame(): void {
        const game = this.pendingDeletionGame;
        if (!game) {
            return;
        }

        this.gameClientService.deleteGame(game.id).subscribe({
            next: () => {
                this.removeGameFromList(game.id);
                this.closeDeleteConfirmation();
            },
            error: (err: unknown) => {
                if (this.isRecord(err) && err.status === HttpStatusCode.NotFound) {
                    this.notificationService.warning(ERROR_MESSAGES.gameAlreadyDeleted);
                    this.removeGameFromList(game.id);
                    this.closeDeleteConfirmation();
                    return;
                }
                this.notificationService.error(ERROR_MESSAGES.deleteGameError);
            },
        });
    }

    private removeGameFromList(id: string): void {
        this.games = this.games.filter((game) => game.id !== id);
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && !!value;
    }

    toggleVisibility(game: Game): void {
        const previousVisibility = game.isVisible;
        game.isVisible = !game.isVisible;

        this.gameClientService.updateGame(game.id, { isVisible: game.isVisible }).subscribe({
            error: () => {
                game.isVisible = previousVisibility;
                this.notificationService.error(ERROR_MESSAGES.toggleVisibilityError);
            },
        });
    }

    openCreateForm(): void {
        this.showCreateForm = true;
    }

    closeCreateForm(): void {
        this.showCreateForm = false;
    }

    onFormSubmitted(data: GameSetupData): void {
        this.closeCreateForm();
        this.router.navigate(['/edit-game-page'], {
            queryParams: { mode: data.mode, size: data.size },
            replaceUrl: true,
        });
    }

    ngOnDestroy(): void {
        this.destroySubject.next();
        this.destroySubject.complete();
    }
}
