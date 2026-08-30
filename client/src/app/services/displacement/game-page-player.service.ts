import { Injectable } from '@angular/core';
import { GameSessionPlayer, GameSessionState } from '@common/game-session';
import { PlayerType } from '@common/player';
import { Playstyle, RoomState } from '@common/wait-room';

@Injectable({
    providedIn: 'root',
})
// REMPLACER TOUS LES IF NULL
export class GamePagePlayerService {
    getActivePlayer(session: GameSessionState | null): GameSessionPlayer | null {
        // si la session est nulle pas de joueurs actifs
        if (!session) {
            return null;
        }

        // sinon, on prend le joueur actif de la session et on trouve le
        // joueur avec cet ID
        const activePlayerId = session.activePlayerId;
        const activePlayer = session.players.find((player) => player.id === activePlayerId);

        return activePlayer ?? null;
    }

    getOrderedPlayers(session: GameSessionState | null): GameSessionPlayer[] {
        // si la session est nulle, on retourne une liste vide parce qu'on ne peut
        // pas mettre les joueurs en ordre
        if (!session) {
            return [];
        }

        return [...session.players].sort((firstPlayer, secondPlayer) => firstPlayer.turnOrder - secondPlayer.turnOrder);
    }

    getCurrentPlayersCount(session: GameSessionState | null, room: RoomState | null): number {
        if (session) {
            return session.players.filter((player) => !player.hasAbandoned).length;
        }

        // si le jeu dans la session n'est pas disponible, vérification de la salle directement
        // va conserver les joueurs ayant abandonné la partie, ce qui va donner une valeur
        // moins précise de la valeur des joueurs de la salle
        if (room) {
            return room.players.length;
        }

        return 0;
    }

    getCurrentPlayerFromSocket(session: GameSessionState | null, socketId: string): GameSessionPlayer | null {
        if (!session) {
            return null;
        }

        const players = session.players;
        const matchingPlayer = players.find((player) => player.id === socketId);
        return matchingPlayer ?? null;
    }

    isOrganizer(session: GameSessionState | null, playerId: string): boolean {
        if (!session) {
            return false;
        }

        const player = session.players.find((sessionPlayer) => sessionPlayer.id === playerId);
        return player?.isHost ?? false;
    }

    isActivePlayer(activePlayer: GameSessionPlayer | null, playerId: string): boolean {
        return activePlayer?.id === playerId;
    }

    isPlayerAbandoned(session: GameSessionState | null, playerId: string): boolean {
        if (!session) {
            return false;
        }

        const player = session.players.find((sessionPlayer) => sessionPlayer.id === playerId);
        return player?.hasAbandoned ?? false;
    }

    isVirtualPlayer(player: GameSessionPlayer): boolean {
        return player.playerType === PlayerType.VirtualPlayer;
    }

    isVirtualPlayerOffensive(player: GameSessionPlayer): boolean {
        return this.isVirtualPlayer(player) && player.playstyle === Playstyle.Offensive;
    }

    isVirtualPlayerDefensive(player: GameSessionPlayer): boolean {
        return this.isVirtualPlayer(player) && player.playstyle === Playstyle.Defensive;
    }

    getPlayerTypeLabel(player: GameSessionPlayer): string {
        if (!this.isVirtualPlayer(player)) {
            return 'Humain';
        }

        if (player.playstyle === Playstyle.Defensive) {
            return 'JV défensif';
        }

        if (player.playstyle === Playstyle.Offensive) {
            return 'JV agressif';
        }

        return 'Joueur Virtuel';
    }
}
