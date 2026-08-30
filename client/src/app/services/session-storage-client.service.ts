import { Injectable } from '@angular/core';
import { Game } from '@common/game';
import { Observable } from 'rxjs';
import { GameClientService } from './game-client.service';

@Injectable({
    providedIn: 'root',
})
export class SessionStorageClientService {
    constructor(private readonly gameClientService: GameClientService) {}

    saveGameInSessionStorage(game: Game): void {
        sessionStorage.setItem(game.id, JSON.stringify(game));
    }

    retrieveGameInSessionStorage(gameId: string): Game | undefined {
        const gameData = sessionStorage.getItem(gameId);
        if (!gameData) {
            return undefined;
        }

        return JSON.parse(gameData);
    }

    removeGameFromSessionStorage(gameName: string): void {
        sessionStorage.removeItem(gameName);
    }

    sendGameToServer(gameName: string): Observable<Game> {
        const game = this.retrieveGameInSessionStorage(gameName);

        if (!game) {
            throw new Error(`Jeu '${gameName}' introuvable dans SessionStorage`);
        }

        return this.gameClientService.addGame(game);
    }
}
