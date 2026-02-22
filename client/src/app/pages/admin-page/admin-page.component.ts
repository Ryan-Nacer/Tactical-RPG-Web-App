import { CommonModule } from '@angular/common';
import { HttpStatusCode } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GameCardComponent } from '@app/components/game-card/game-card.component';
import { GameSetupData, GameSetupFormComponent } from '@app/components/game-setup-form/game-setup-form.component';
import { GameClientService } from '@app/services/game-client.service';
import { GameSocketService } from '@app/services/game-socket.service';
import { Game } from '@common/game';
import { Subject, takeUntil } from 'rxjs';

const ERROR_MESSAGES = {
    loadGamesError: 'Erreur lors du chargement des jeux',
    gameAlreadyDeleted: 'Ce jeu a déjà été supprimé.',
    deleteGameError: 'Impossible de supprimer le jeu. Réessayez.',
    toggleVisibilityError: 'Impossible de modifier la visibilité du jeu. Réessayez.',
} as const;

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
    private readonly destroySubject = new Subject<void>();

    constructor(
        private readonly gameClientService: GameClientService,
        private readonly gameSocketService: GameSocketService,
        private readonly router: Router,
    ) {}

    ngOnInit(): void {
        this.loadGames();

        this.gameSocketService.gameListUpdated$.pipe(takeUntil(this.destroySubject)).subscribe(() => {
            this.loadGames();
        });
    }

    loadGames(): void {
        this.gameClientService.getAllGames().subscribe({
            next: (games) => {
                this.games = games;
                this.isLoading = false;
            },
            error: () => {
                this.isLoading = false;
                alert(ERROR_MESSAGES.loadGamesError);
            },
        });
    }

    deleteGame(id: string): void {
        this.gameClientService.deleteGame(id).subscribe({
            next: () => {
                this.removeGameFromList(id);
            },
            error: (err: unknown) => {
                if (this.isRecord(err) && err.status === HttpStatusCode.NotFound) {
                    alert(ERROR_MESSAGES.gameAlreadyDeleted);
                    this.removeGameFromList(id);
                    return;
                }
                alert(ERROR_MESSAGES.deleteGameError);
            },
        });
    }

    private removeGameFromList(id: string): void {
        this.games = this.games.filter((game) => game.id !== id);
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    toggleVisibility(game: Game): void {
        const previousVisibility = game.isVisible;
        game.isVisible = !game.isVisible;

        this.gameClientService.updateGame(game.id, { isVisible: game.isVisible }).subscribe({
            error: () => {
                game.isVisible = previousVisibility;
                alert(ERROR_MESSAGES.toggleVisibilityError);
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
        });
    }

    ngOnDestroy(): void {
        this.destroySubject.next();
        this.destroySubject.complete();
    }
}
