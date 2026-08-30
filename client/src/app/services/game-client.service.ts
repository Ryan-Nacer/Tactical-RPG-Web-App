import { HttpClient, HttpStatusCode } from '@angular/common/http';
import { ElementRef, inject, Injectable } from '@angular/core';
import { NotificationService } from '@app/services/notifications/notification.service';
import { Game } from '@common/game';
import { Observable, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ImageCaptureService } from './image-capture.service';

const GAME_NOT_FOUND_TEXT = 'Could not find game';

@Injectable({
    providedIn: 'root',
})
export class GameClientService {
    private readonly baseUrl = environment.serverUrl;
    private readonly imageCaptureService = inject(ImageCaptureService);
    private readonly notificationService = inject(NotificationService);

    constructor(private readonly http: HttpClient) {}

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
                            this.notificationService.success('Le jeu original a ete supprime. Un nouveau jeu a ete cree avec succes');
                        }),
                    );
                }
                return throwError(() => err);
            }),
        );
    }

    private isNotFoundError(err: unknown): boolean {
        if (!this.isRecord(err)) {
            return false;
        }

        return err.status === HttpStatusCode.NotFound || this.hasGameNotFoundMessage(err.error);
    }

    private hasGameNotFoundMessage(payload: unknown): boolean {
        return this.extractMessageStrings(payload).some((message) => message.includes(GAME_NOT_FOUND_TEXT));
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && !!value;
    }

    extractErrors(err: unknown): string[] {
        if (this.isRecord(err)) {
            const extractedErrors = this.extractMessageStrings(err.error).filter((message) => message.trim());
            if (extractedErrors.length > 0) {
                return extractedErrors;
            }
        }
        if (err instanceof Error && err.message.trim()) {
            return [err.message];
        }
        return ['Erreur inconnue'];
    }

    private extractMessageStrings(payload: unknown): string[] {
        if (typeof payload === 'string') {
            return [payload];
        }
        if (Array.isArray(payload)) {
            return payload.filter((value): value is string => typeof value === 'string');
        }
        if (!this.isRecord(payload)) {
            return [];
        }
        return this.extractMessageStrings(payload.message);
    }

    saveGame(game: Game, gridCapture: ElementRef<HTMLElement>): Observable<void> {
        return this.imageCaptureService.captureImage(gridCapture.nativeElement).pipe(
            map((image) => ({ ...game, imageURL: image, isVisible: false })),
            switchMap((gameWithImage): Observable<void> => {
                if (game.id) {
                    return this.updateOrCreateGame(gameWithImage);
                }
                return this.createGame(gameWithImage);
            }),
        );
    }
}
