import { HttpClient, HttpStatusCode } from '@angular/common/http';
import { Injectable, ElementRef, inject } from '@angular/core';
import { Game } from '@common/game';
import { ImageCaptureService } from './image-capture.service';
import { environment } from 'src/environments/environment';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';

// service de communication de jeu qui va faire les requêtes HTML
// comme c'est un service, on veut qu'il soir injectable
// va faire les requêtes vers les service du serveur qui gère lui aussi les jeux

@Injectable({
    providedIn: 'root',
})
export class GameClientService {
    // pour avoir adresse du serveur auquel les requêtes seront
    // adressées
    private readonly baseUrl = environment.serverUrl;

    private readonly imageCaptureService = inject(ImageCaptureService);

    constructor(private http: HttpClient) {}

    getAllGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/game`);
    }

    getVisibleGames(): Observable<Game[]> {
        return this.http.get<Game[]>(`${this.baseUrl}/game/visible`);
    }

    getGame(id: string): Observable<Game> {
        return this.http.get<Game>(`${this.baseUrl}/game/${id}`);
    }

    deleteGame(id: string): Observable<Game> {
        return this.http.delete<Game>(`${this.baseUrl}/game/${id}`);
    }

    updateGame(id: string, game: Partial<Game>): Observable<void> {
        return this.http.patch<void>(`${this.baseUrl}/game/${id}`, game);
    }

    addGame(game: Game): Observable<Game> {
        return this.http.post<Game>(`${this.baseUrl}/game`, game);
    }

    private createGame(game: Game): Observable<void> {
        const newId = Date.now().toString();
        return this.addGame({ ...game, id: newId }).pipe(map(() => undefined as void));
    }

    private updateOrCreateGame(game: Game): Observable<void> {
        return this.updateGame(game.id, game).pipe(
            catchError((err: unknown): Observable<void> => {
                if (this.isNotFoundError(err)) {
                    return this.createGame(game).pipe(
                        tap(() => {
                            alert('Le jeu original a été supprimé. Un nouveau jeu a été créé avec succès');
                        }),
                    );
                } else {
                    return throwError(() => err);
                }
            }),
        );
    }

    // TODO: Regarder si le code est simplifiable (Not found devrait toujours)
    // retourner 404
    private isNotFoundError(err: unknown) {
        return (
            this.isRecord(err) &&
            (err.status === HttpStatusCode.NotFound ||
                (typeof err.error === 'string' && err.error.includes('Could not find game')) ||
                (this.isRecord(err.error) && typeof err.error.message === 'string' && err.error.message.includes('Could not find game')))
        );
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    extractErrors(err: unknown): string[] {
        if (this.isRecord(err)) {
            const payload = err.error;
            if (Array.isArray(payload)) {
                return payload.filter((value): value is string => typeof value === 'string');
            }
            if (this.isRecord(payload)) {
                const message = payload.message;
                if (Array.isArray(message)) {
                    return message.filter((value): value is string => typeof value === 'string');
                }
                if (typeof message === 'string' && message.trim()) {
                    return [message];
                }
            }
            if (typeof payload === 'string' && payload.trim()) {
                return [payload];
            }
        }
        if (err instanceof Error && err.message.trim()) {
            return [err.message];
        }
        return ['Erreur inconnue'];
    }

    saveGame(game: Game, gridCapture: ElementRef<HTMLElement>): Observable<void> {
        return this.imageCaptureService.captureImage(gridCapture.nativeElement).pipe(
            map((image) => ({ ...game, imageURL: image })),

            switchMap((gameWithImage): Observable<void> => {
                if (game.id) {
                    return this.updateOrCreateGame(gameWithImage);
                } else {
                    return this.createGame(gameWithImage);
                }
            }),
        );
    }
}
