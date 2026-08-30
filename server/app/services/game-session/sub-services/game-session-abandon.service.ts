import { buildCombatMessage, buildSystemMessage } from '@app/services/game-session/utils/game-session-message.factory';
import { Mode, ObjectId } from '@common/game';
import { CombatEndPayload, GameSessionMessage, GameSessionPlayer, GameSessionState } from '@common/game-session';
import { PlayerType } from '@common/player';

const COMBAT_VICTORY_TARGET = 3;

export interface GameSessionAbandonHooks {
    dropFlagOnDefeatTile: (session: GameSessionState, defeatedPlayer: GameSessionPlayer) => void;
    teleportToSpawn: (session: GameSessionState, player: GameSessionPlayer) => void;
    endCombat: (session: GameSessionState) => void;
    startTransitionToNextTurn: (session: GameSessionState) => void;
    appendMessage: (session: GameSessionState, message: GameSessionMessage) => void;
    emitCombatEnd: (payload: CombatEndPayload) => void;
}

export class GameSessionAbandonService {
    handleCombatAbandon(session: GameSessionState, abandonedPlayer: GameSessionPlayer, hooks: GameSessionAbandonHooks): boolean {
        if (!session.combatState || session.countdownMode !== 'combat') {
            return false;
        }

        const { attackerId, defenderId } = session.combatState;
        if (abandonedPlayer.id !== attackerId && abandonedPlayer.id !== defenderId) {
            return false;
        }

        const opponentId = abandonedPlayer.id === attackerId ? defenderId : attackerId;
        const opponent = session.players.find((player) => !player.hasAbandoned && player.id === opponentId);

        abandonedPlayer.health = abandonedPlayer.maxHealth;
        hooks.dropFlagOnDefeatTile(session, abandonedPlayer);
        hooks.teleportToSpawn(session, abandonedPlayer);

        if (!opponent) {
            hooks.endCombat(session);
            return true;
        }

        opponent.combatsWon += 1;
        hooks.appendMessage(session, buildSystemMessage(`${opponent.name} gagne le combat (abandon).`, 'combat-end', [opponent, abandonedPlayer]));
        hooks.appendMessage(
            session,
            buildCombatMessage(`${opponent.name} remporte automatiquement le combat par abandon.`, opponent, abandonedPlayer),
        );

        hooks.emitCombatEnd({
            roomId: session.roomId,
            attackerId,
            defenderId,
            winnerId: opponent.id,
            loserId: abandonedPlayer.id,
            isTie: false,
            reason: opponent.combatsWon === COMBAT_VICTORY_TARGET ? 'game-over' : 'abandon',
        });

        if (opponent.combatsWon === COMBAT_VICTORY_TARGET) {
            session.winnerPlayerId = opponent.id;
            session.countdownMode = 'disabled';
            session.turnRemainingSeconds = 0;
            hooks.appendMessage(
                session,
                buildSystemMessage(`${opponent.name} remporte la partie avec ${COMBAT_VICTORY_TARGET} victoires.`, 'game-end', [opponent]),
            );
        }

        hooks.endCombat(session);
        if (!session.winnerPlayerId && session.activePlayerId === abandonedPlayer.id) {
            hooks.startTransitionToNextTurn(session);
        }
        return true;
    }

    getCancellationMessage(mode: Mode | undefined, session: GameSessionState): string | undefined {
        const activeHumansCount = session.players.filter((player) => !player.hasAbandoned && player.playerType !== PlayerType.VirtualPlayer).length;
        if (activeHumansCount === 0) {
            return 'La partie est annulée, car il ne reste aucun joueur humain en jeu.';
        }
        const activePlayersCount = session.players.filter((player) => !player.hasAbandoned).length;
        if (activePlayersCount === 0) {
            return 'La partie est annulée, car aucun joueur ne reste en jeu.';
        }

        if (mode === Mode.Classic && activePlayersCount === 1) {
            return 'La partie classique est annulée, car il ne reste qu un seul joueur en jeu.';
        }

        if (mode === Mode.CTF) {
            const hasTeamA = session.players.some((player) => !player.hasAbandoned && player.team === 'A');
            const hasTeamB = session.players.some((player) => !player.hasAbandoned && player.team === 'B');
            if (!hasTeamA || !hasTeamB) {
                return "La partie CTF est annulée, car une équipe n'a plus de joueurs.";
            }
        }

        return undefined;
    }

    disableDebugModeAfterHostAbandon(session: GameSessionState, abandonedPlayer: GameSessionPlayer, hooks: GameSessionAbandonHooks): void {
        if (!abandonedPlayer.isHost || !session.debugMode) {
            return;
        }

        session.debugMode = false;
        hooks.appendMessage(session, buildSystemMessage('Le mode debogage est desactive.', 'debug'));
    }

    clearAbandonedPlayerSpawnMarker(session: GameSessionState, spawn: { row: number; column: number } | undefined): void {
        if (!spawn) {
            return;
        }

        session.cells = session.cells.map((cell) => {
            if (cell.row !== spawn.row || cell.column !== spawn.column || cell.object !== ObjectId.Start) {
                return cell;
            }

            return { row: cell.row, column: cell.column, tile: cell.tile };
        });
    }
}
