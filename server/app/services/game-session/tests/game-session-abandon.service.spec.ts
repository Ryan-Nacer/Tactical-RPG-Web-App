import { GameSessionAbandonHooks, GameSessionAbandonService } from '@app/services/game-session/sub-services/game-session-abandon.service';
import { createAppendMessageMock, createTestPlayer as createPlayer, createTestSession as createSession } from '@app/services/game-session/tests/game-session-sub-services.spec.utils';
import { Mode, ObjectId, TileId } from '@common/game';
import { GameSessionPlayer, GameSessionState } from '@common/game-session';
import { PlayerType } from '@common/player';

const COMBAT_VICTORY_TARGET = 3;

const createHooks = (): GameSessionAbandonHooks & {
    dropFlagOnDefeatTile: jest.Mock;
    appendMessage: jest.Mock;
    teleportToSpawn: jest.Mock;
    endCombat: jest.Mock;
    startTransitionToNextTurn: jest.Mock;
    emitCombatEnd: jest.Mock;
} => ({
    dropFlagOnDefeatTile: jest.fn((session: GameSessionState, player: GameSessionPlayer) => {
        const dropCell = session.cells.find((cell) => cell.object === undefined && cell.tile === TileId.Base);
        if (dropCell && player.hasFlag) {
            dropCell.object = ObjectId.Flag;
            player.hasFlag = false;
        }
    }),
    teleportToSpawn: jest.fn((session: GameSessionState, player: GameSessionPlayer) => {
        player.position = { row: 9, column: 9 };
        session.countdownCombatPlayerIds = [];
    }),
    endCombat: jest.fn(),
    startTransitionToNextTurn: jest.fn(),
    appendMessage: createAppendMessageMock(),
    emitCombatEnd: jest.fn(),
});

/**
 * Portee :
 * - effets de bord du sous-service d'abandon (combat, mode debug, vérifications d'annulation)
 * Cas limites :
 * - abandon pendant un combat
 * - abandon de l'hote lorsque le mode debug est actif
 * - règles d'annulation sans humain / sans équipe restante
 */
/**
 * Strategie :
 * - tester GameSessionAbandonService sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('GameSessionAbandonService', () => {
    let service: GameSessionAbandonService;

    beforeEach(() => {
        service = new GameSessionAbandonService();
    });

    it('clears the start marker of an abandoned player', () => {
        const session = createSession([createPlayer('player-1'), createPlayer('player-2')]);

        service.clearAbandonedPlayerSpawnMarker(session, { row: 0, column: 0 });

        expect(session.cells.find((cell) => cell.row === 0 && cell.column === 0)?.object).toBeUndefined();
    });

    it('disables debug mode when the host abandons', () => {
        const host = createPlayer('player-1', { isHost: true });
        const session = createSession([host, createPlayer('player-2')], { debugMode: true });
        const hooks = createHooks();

        service.disableDebugModeAfterHostAbandon(session, host, hooks);

        expect(session.debugMode).toBe(false);
        expect(hooks.appendMessage).toHaveBeenCalledWith(
            session,
            expect.objectContaining({ text: 'Le mode debogage est desactive.', eventType: 'debug' }),
        );
    });

    it('does not disable debug mode when a non-host abandons', () => {
        const nonHost = createPlayer('player-2', { isHost: false });
        const session = createSession([createPlayer('player-1'), nonHost], { debugMode: true });
        const hooks = createHooks();

        service.disableDebugModeAfterHostAbandon(session, nonHost, hooks);

        expect(session.debugMode).toBe(true);
        expect(hooks.appendMessage).not.toHaveBeenCalled();
    });

    it('does nothing when host abandons and debug mode is already disabled', () => {
        const host = createPlayer('player-1', { isHost: true });
        const session = createSession([host, createPlayer('player-2')], { debugMode: false });
        const hooks = createHooks();

        service.disableDebugModeAfterHostAbandon(session, host, hooks);

        expect(session.debugMode).toBe(false);
        expect(hooks.appendMessage).not.toHaveBeenCalled();
    });

    it('returns undefined cancellation message when game can continue', () => {
        const session = createSession([
            createPlayer('player-1', { team: 'A' }),
            createPlayer('player-2', { team: 'B' }),
        ]);

        const message = service.getCancellationMessage(Mode.CTF, session);

        expect(message).toBeUndefined();
    });

    it('returns the CTF cancellation message when one team has no remaining players', () => {
        const session = createSession([
            createPlayer('player-1', { team: 'A', hasAbandoned: true }),
            createPlayer('player-2', { team: 'B' }),
        ]);

        const message = service.getCancellationMessage(Mode.CTF, session);

        expect(message).toBe("La partie CTF est annulée, car une équipe n'a plus de joueurs.");
    });

    it('returns the classic cancellation message when only one active player remains', () => {
        const session = createSession([
            createPlayer('player-1', { hasAbandoned: true }),
            createPlayer('player-2'),
        ]);

        const message = service.getCancellationMessage(Mode.Classic, session);

        expect(message).toBe('La partie classique est annulée, car il ne reste qu un seul joueur en jeu.');
    });

    it('returns the no-human cancellation message when only virtual players remain', () => {
        const session = createSession([
            createPlayer('player-1', { playerType: PlayerType.VirtualPlayer, hasAbandoned: false, team: 'A' }),
            createPlayer('player-2', { playerType: PlayerType.VirtualPlayer, hasAbandoned: false, team: 'B' }),
            createPlayer('player-3', { playerType: PlayerType.HumanPlayer, hasAbandoned: true, team: 'A' }),
        ]);

        const message = service.getCancellationMessage(Mode.CTF, session);

        expect(message).toBe('La partie est annulée, car il ne reste aucun joueur humain en jeu.');
    });

    it('awards a combat win to the opponent when the attacker abandons in combat', () => {
        const attacker = createPlayer('player-1', { hasAbandoned: true });
        const defender = createPlayer('player-2');
        const session = createSession([attacker, defender], {
            activePlayerId: 'player-1',
            countdownMode: 'combat',
            phase: 'turn',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
            countdownCombatPlayerIds: ['player-1', 'player-2'],
        });
        const hooks = createHooks();

        const handled = service.handleCombatAbandon(session, attacker, hooks);

        expect(handled).toBe(true);
        expect(defender.combatsWon).toBe(1);
        expect(attacker.health).toBe(attacker.maxHealth);
        expect(hooks.dropFlagOnDefeatTile).toHaveBeenCalledWith(session, attacker);
        expect(hooks.teleportToSpawn).toHaveBeenCalledWith(session, attacker);
        expect(hooks.emitCombatEnd).toHaveBeenCalledWith(
            expect.objectContaining({
                roomId: 'ROOM01',
                attackerId: 'player-1',
                defenderId: 'player-2',
                winnerId: 'player-2',
                loserId: 'player-1',
                isTie: false,
                reason: 'abandon',
            }),
        );
        expect(hooks.endCombat).toHaveBeenCalled();
        expect(hooks.startTransitionToNextTurn).toHaveBeenCalledWith(session);
        expect(session.messages.some((message) => message.text.includes('gagne le combat (abandon)'))).toBe(true);
    });

    it('awards a combat win to the opponent when the defender abandons in combat', () => {
        const attacker = createPlayer('player-1');
        const defender = createPlayer('player-2', { hasAbandoned: true });
        const session = createSession([attacker, defender], {
            activePlayerId: 'player-1',
            countdownMode: 'combat',
            phase: 'turn',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
            countdownCombatPlayerIds: ['player-1', 'player-2'],
        });
        const hooks = createHooks();

        const handled = service.handleCombatAbandon(session, defender, hooks);

        expect(handled).toBe(true);
        expect(attacker.combatsWon).toBe(1);
        expect(defender.health).toBe(defender.maxHealth);
        expect(hooks.dropFlagOnDefeatTile).toHaveBeenCalledWith(session, defender);
        expect(hooks.emitCombatEnd).toHaveBeenCalledWith(
            expect.objectContaining({ winnerId: 'player-1', loserId: 'player-2', reason: 'abandon' }),
        );
        expect(hooks.startTransitionToNextTurn).not.toHaveBeenCalled();
    });

    it('drops the flag before teleporting when a player abandons during combat', () => {
        const attacker = createPlayer('player-1', { hasAbandoned: true, hasFlag: true, position: { row: 2, column: 2 } });
        const defender = createPlayer('player-2');
        const session = createSession(
            [attacker, defender],
            {
                activePlayerId: 'player-1',
                countdownMode: 'combat',
                phase: 'turn',
                combatState: {
                    attackerId: 'player-1',
                    defenderId: 'player-2',
                    currentTurnNumber: 1,
                    turnsHistory: [],
                },
            },
            [
                { row: 2, column: 2, tile: TileId.Door },
                { row: 2, column: 1, tile: TileId.Base },
                { row: 1, column: 2, tile: TileId.Base, object: ObjectId.Heal },
            ],
        );
        const hooks = createHooks();

        const handled = service.handleCombatAbandon(session, attacker, hooks);

        expect(handled).toBe(true);
        expect(attacker.hasFlag).toBe(false);
        expect(session.cells.find((cell) => cell.row === 2 && cell.column === 1)?.object).toBe(ObjectId.Flag);
    });

    it('returns false when handling abandon outside combat', () => {
        const attacker = createPlayer('player-1', { hasAbandoned: true });
        const defender = createPlayer('player-2');
        const session = createSession([attacker, defender], {
            countdownMode: 'turn',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });
        const hooks = createHooks();

        const handled = service.handleCombatAbandon(session, attacker, hooks);

        expect(handled).toBe(false);
        expect(hooks.teleportToSpawn).not.toHaveBeenCalled();
        expect(hooks.emitCombatEnd).not.toHaveBeenCalled();
        expect(hooks.endCombat).not.toHaveBeenCalled();
    });

    it('returns false when handling abandon with no combat state', () => {
        const attacker = createPlayer('player-1', { hasAbandoned: true });
        const defender = createPlayer('player-2');
        const session = createSession([attacker, defender], {
            countdownMode: 'combat',
            combatState: undefined,
        });
        const hooks = createHooks();

        const handled = service.handleCombatAbandon(session, attacker, hooks);

        expect(handled).toBe(false);
        expect(hooks.teleportToSpawn).not.toHaveBeenCalled();
        expect(hooks.emitCombatEnd).not.toHaveBeenCalled();
        expect(hooks.endCombat).not.toHaveBeenCalled();
    });

    it('returns false when abandoning player is not part of the combat', () => {
        const attacker = createPlayer('player-1');
        const defender = createPlayer('player-2');
        const outsider = createPlayer('player-3', { hasAbandoned: true });
        const session = createSession([attacker, defender, outsider], {
            countdownMode: 'combat',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });
        const hooks = createHooks();

        const handled = service.handleCombatAbandon(session, outsider, hooks);

        expect(handled).toBe(false);
        expect(hooks.teleportToSpawn).not.toHaveBeenCalled();
        expect(hooks.emitCombatEnd).not.toHaveBeenCalled();
        expect(hooks.endCombat).not.toHaveBeenCalled();
    });

    it('ends combat without winner when the opponent no longer exists', () => {
        const attacker = createPlayer('player-1', { hasAbandoned: true });
        const defender = createPlayer('player-2', { hasAbandoned: true });
        const session = createSession([attacker, defender], {
            countdownMode: 'combat',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });
        const hooks = createHooks();

        const handled = service.handleCombatAbandon(session, attacker, hooks);

        expect(handled).toBe(true);
        expect(hooks.endCombat).toHaveBeenCalled();
        expect(hooks.emitCombatEnd).not.toHaveBeenCalled();
    });

    it('ends the game when abandon grants the third combat victory', () => {
        const attacker = createPlayer('player-1', { hasAbandoned: true });
        const defender = createPlayer('player-2', { combatsWon: COMBAT_VICTORY_TARGET - 1 });
        const session = createSession([attacker, defender], {
            activePlayerId: 'player-1',
            countdownMode: 'combat',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });
        const hooks = createHooks();

        const handled = service.handleCombatAbandon(session, attacker, hooks);

        expect(handled).toBe(true);
        expect(defender.combatsWon).toBe(COMBAT_VICTORY_TARGET);
        expect(session.winnerPlayerId).toBe('player-2');
        expect(session.countdownMode).toBe('disabled');
        expect(session.turnRemainingSeconds).toBe(0);
        expect(hooks.emitCombatEnd).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'game-over', winnerId: 'player-2' }),
        );
        expect(session.messages.some((message) => message.eventType === 'game-end')).toBe(true);
        expect(hooks.startTransitionToNextTurn).not.toHaveBeenCalled();
    });
});
