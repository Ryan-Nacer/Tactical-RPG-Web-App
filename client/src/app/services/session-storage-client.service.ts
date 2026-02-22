import { Injectable } from '@angular/core';
import { Game as ClientGame } from '@app/interfaces/game';
import { Game as CommonGame } from '@common/game';
import { Observable } from 'rxjs';
import { GameClientService } from './game-client.service';

@Injectable({
    providedIn: 'root',
})
export class SessionStorageClientService {
    constructor(private gameClientService: GameClientService) {}

    saveGameInSessionStorage(game: ClientGame): void {
        // Sauvegarder directement le jeu dans sessionStorage
        sessionStorage.setItem(game.id, JSON.stringify(game));
    }

    retrieveGameInSessionStorage(gameId: string): ClientGame | undefined {
        const gameData = sessionStorage.getItem(gameId);
        if (gameData === null) {
            return undefined;
        }

        return JSON.parse(gameData);
    }

    /**
     * Supprime un jeu du sessionStorage
     */
    removeGameFromSessionStorage(gameName: string): void {
        sessionStorage.removeItem(gameName);
    }

    /**
     * Envoie un jeu du sessionStorage au serveur
     */

    sendGameToServer(gameName: string): Observable<CommonGame> {
        const game = this.retrieveGameInSessionStorage(gameName);

        if (!game) {
            throw new Error(`Jeu '${gameName}' introuvable dans SessionStorage`);
        }

        // Supprimer la propriété _id qui n'est pas dans CreateGameDto
        const gameWithoutMongoId = { ...game, size: String(game.size) };

        return this.gameClientService.addGame(gameWithoutMongoId);
    }
}
