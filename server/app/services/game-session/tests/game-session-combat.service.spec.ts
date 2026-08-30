import { CombatResolutionService } from '@app/services/combat/combat-resolution.service';
import { GameSessionCombatHooks, GameSessionCombatService } from '@app/services/game-session/sub-services/game-session-combat.service';
import { createAppendMessageMock, createTestPlayer as createPlayer, createTestSession as createSession } from '@app/services/game-session/tests/game-session-sub-services.spec.utils';
import { COMBAT_TURN_DURATION_SECONDS, CombatPosture } from '@common/combat';
import { Mode, ObjectId } from '@common/game';
import { GameSessionPlayer, GameSessionState } from '@common/game-session';

const COMBAT_VICTORY_TARGET = 3;
const PRE_COMBAT_TURN_SECONDS = 21;

const createHooks = (mode: Mode = Mode.Classic): GameSessionCombatHooks & {
    appendMessage: jest.Mock;
    emitCombatEnd: jest.Mock;
    dropFlagOnDefeatTile: jest.Mock;
    teleportToSpawn: jest.Mock;
    completeTurn: jest.Mock;
    getMode: jest.Mock;
} => ({
    appendMessage: createAppendMessageMock(),
    emitCombatEnd: jest.fn(),
    dropFlagOnDefeatTile: jest.fn((session: GameSessionState, defeatedPlayer: GameSessionPlayer) => {
        const droppedFlagCell = session.cells.find(
            (cell) => cell.row === defeatedPlayer.position.row && cell.column === defeatedPlayer.position.column,
        );
        if (droppedFlagCell) {
            droppedFlagCell.object = ObjectId.Flag;
        }
        defeatedPlayer.hasFlag = false;
    }),
    teleportToSpawn: jest.fn((_: GameSessionState, player: GameSessionPlayer) => {
        player.position = { row: 9, column: 9 };
    }),
    completeTurn: jest.fn((_: GameSessionState, player: GameSessionPlayer) => {
        player.actionsLeft = 0;
    }),
    getMode: jest.fn().mockReturnValue(mode),
});

const createTurnResult = (attackerHealthAfter = 6, defenderHealthAfter = 6) => ({
    attackerToDefender: {
        attackerId: 'player-1',
        defenderId: 'player-2',
        attackerPosture: CombatPosture.Offensive,
        attackerAttackBase: 4,
        attackerAttackPostureBonus: 2,
        attackerAttackDiceRoll: 1,
        attackerAttackPenalty: 0,
        attackerAttackTotal: 7,
        defenderPosture: CombatPosture.Defensive,
        defenderDefenseBase: 4,
        defenderDefensePostureBonus: 2,
        defenderDefenseDiceRoll: 1,
        defenderDefensePenalty: 0,
        defenderDefenseTotal: 7,
        damageDealt: 0,
        defenderHealthAfter,
    },
    defenderToAttacker: {
        attackerId: 'player-2',
        defenderId: 'player-1',
        attackerPosture: CombatPosture.Defensive,
        attackerAttackBase: 4,
        attackerAttackPostureBonus: 0,
        attackerAttackDiceRoll: 1,
        attackerAttackPenalty: 0,
        attackerAttackTotal: 5,
        defenderPosture: CombatPosture.Offensive,
        defenderDefenseBase: 4,
        defenderDefensePostureBonus: 0,
        defenderDefenseDiceRoll: 1,
        defenderDefensePenalty: 0,
        defenderDefenseTotal: 5,
        damageDealt: 0,
        defenderHealthAfter: attackerHealthAfter,
    },
    attackerHealthAfter,
    defenderHealthAfter,
    damageToDefender: 0,
    damageToAttacker: 0,
} as never);

/**
 * Portee :
 * - flux du sous-service de combat (démarrage, résolution de manche, conditions de fin)
 * Cas limites :
 * - résolution des égalités
 * - KO avec chute du drapeau et téléportation au point de départ
 * - seuil de fin de partie en mode classique
 */
/**
 * Strategie :
 * - tester GameSessionCombatService sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('GameSessionCombatService', () => {
    let service: GameSessionCombatService;
    let combatResolutionServiceMock: Pick<CombatResolutionService, 'resolveCombatTurnSimultaneous'>;

    beforeEach(() => {
        combatResolutionServiceMock = {
            resolveCombatTurnSimultaneous: jest.fn().mockReturnValue(createTurnResult()),
        };
        service = new GameSessionCombatService(combatResolutionServiceMock as CombatResolutionService);
    });

    it('starts a combat state and switches the countdown to combat', () => {
        const attacker = createPlayer('player-1');
        const defender = createPlayer('player-2');
        const session = createSession([attacker, defender], { turnRemainingSeconds: PRE_COMBAT_TURN_SECONDS });
        const hooks = createHooks();

        service.startCombat(session, 'player-1', 'player-2', hooks);

        expect(attacker.combatsTotal).toBe(1);
        expect(defender.combatsTotal).toBe(1);
        expect(session.combatState).toMatchObject({ attackerId: 'player-1', defenderId: 'player-2', currentTurnNumber: 1 });
        expect(session.countdownMode).toBe('combat');
        expect(session.countdownCombatPlayerIds).toEqual(['player-1', 'player-2']);
        expect(session.turnRemainingSeconds).toBe(COMBAT_TURN_DURATION_SECONDS);
        expect(hooks.appendMessage).toHaveBeenCalledWith(
            session,
            expect.objectContaining({ text: 'Le combat commence entre Joueur player-1 et Joueur player-2.' }),
        );
    });

    it('does nothing when combatants are missing', () => {
        const session = createSession([createPlayer('player-1'), createPlayer('player-2')]);
        const hooks = createHooks();

        service.startCombat(session, 'player-1', 'player-3', hooks);

        expect(session.combatState).toBeUndefined();
        expect(hooks.appendMessage).not.toHaveBeenCalled();
    });

    it('advances to the next combat round when nobody is defeated', () => {
        const session = createSession([createPlayer('player-1'), createPlayer('player-2')], {
            countdownMode: 'combat',
            turnRemainingSeconds: COMBAT_TURN_DURATION_SECONDS,
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });
        const hooks = createHooks();

        service.resolveCombatRound(session, hooks);

        expect(session.combatState?.currentTurnNumber).toBe(2);
        expect(session.combatState?.attackerPosture).toBeUndefined();
        expect(session.combatState?.defenderPosture).toBeUndefined();
        expect(session.turnRemainingSeconds).toBe(COMBAT_TURN_DURATION_SECONDS);
        expect(hooks.emitCombatEnd).not.toHaveBeenCalled();
    });

    it('resolves a tie and resets both fighters', () => {
        combatResolutionServiceMock.resolveCombatTurnSimultaneous = jest.fn().mockReturnValue(
            createTurnResult(0, 0),
        );
        const attacker = createPlayer('player-1', { hasFlag: true });
        const defender = createPlayer('player-2', { hasFlag: true });
        attacker.position = { row: 0, column: 0 };
        defender.position = { row: 0, column: 1 };
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

        service.resolveCombatRound(session, hooks);

        expect(attacker.health).toBe(attacker.maxHealth);
        expect(defender.health).toBe(defender.maxHealth);
        expect(attacker.hasFlag).toBe(false);
        expect(defender.hasFlag).toBe(false);
        expect(session.cells.find((cell) => cell.row === 0 && cell.column === 0)?.object).toBe(ObjectId.Flag);
        expect(session.cells.find((cell) => cell.row === 0 && cell.column === 1)?.object).toBe(ObjectId.Flag);
        expect(session.combatState).toBeUndefined();
        expect(hooks.emitCombatEnd).toHaveBeenCalledWith(
            expect.objectContaining({ isTie: true, reason: 'tie', winnerId: undefined, loserId: undefined }),
        );
    });

    it('awards the defender victory when the attacker is defeated', () => {
        combatResolutionServiceMock.resolveCombatTurnSimultaneous = jest.fn().mockReturnValue(
            createTurnResult(0, 6),
        );
        const attacker = createPlayer('player-1');
        const defender = createPlayer('player-2');
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

        service.resolveCombatRound(session, hooks);

        expect(defender.combatsWon).toBe(1);
        expect(attacker.health).toBe(attacker.maxHealth);
        expect(hooks.completeTurn).toHaveBeenCalledWith(session, attacker);
        expect(hooks.emitCombatEnd).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'knockout', winnerId: 'player-2', loserId: 'player-1' }),
        );
    });

    it('tracks turn history and total damage stats when no fighter is defeated', () => {
        combatResolutionServiceMock.resolveCombatTurnSimultaneous = jest.fn().mockReturnValue(
            createTurnResult(4, 5),
        );
        const attacker = createPlayer('player-1');
        const defender = createPlayer('player-2');
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

        service.resolveCombatRound(session, hooks);

        expect(session.combatState?.turnsHistory).toHaveLength(2);
        expect(attacker.totalDamageDone).toBe(1);
        expect(attacker.totalDamageTaken).toBe(2);
        expect(defender.totalDamageDone).toBe(2);
        expect(defender.totalDamageTaken).toBe(1);
        expect(session.combatState?.currentTurnNumber).toBe(2);
        expect(hooks.emitCombatEnd).not.toHaveBeenCalled();
    });

    it('awards the attacker victory and ends a classic game at three wins', () => {
        combatResolutionServiceMock.resolveCombatTurnSimultaneous = jest.fn().mockReturnValue(
            createTurnResult(6, 0),
        );
        const attacker = createPlayer('player-1', { combatsWon: COMBAT_VICTORY_TARGET - 1, hasFlag: true });
        const defender = createPlayer('player-2');
        const session = createSession([attacker, defender], {
            countdownMode: 'combat',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });
        const hooks = createHooks(Mode.Classic);

        service.resolveCombatRound(session, hooks);

        expect(attacker.combatsWon).toBe(COMBAT_VICTORY_TARGET);
        expect(session.winnerPlayerId).toBe('player-1');
        expect(session.countdownMode).toBe('disabled');
        expect(session.turnRemainingSeconds).toBe(0);
        expect(hooks.emitCombatEnd).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'game-over', winnerId: 'player-1', loserId: 'player-2' }),
        );
        expect(session.messages.some((message) => message.eventType === 'game-end')).toBe(true);
    });

    it('does not end a CTF game when the winner reaches three combat wins', () => {
        combatResolutionServiceMock.resolveCombatTurnSimultaneous = jest.fn().mockReturnValue(
            createTurnResult(6, 0),
        );
        const attacker = createPlayer('player-1', { combatsWon: COMBAT_VICTORY_TARGET - 1 });
        const defender = createPlayer('player-2');
        const session = createSession([attacker, defender], {
            countdownMode: 'combat',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });
        const hooks = createHooks(Mode.CTF);

        service.resolveCombatRound(session, hooks);

        expect(attacker.combatsWon).toBe(COMBAT_VICTORY_TARGET);
        expect(session.winnerPlayerId).toBeUndefined();
        expect(session.countdownMode).toBe('turn');
        expect(hooks.emitCombatEnd).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'knockout', winnerId: 'player-1', loserId: 'player-2' }),
        );
    });

    it('restores the defeated player health to max health after combat résolution', () => {
        combatResolutionServiceMock.resolveCombatTurnSimultaneous = jest.fn().mockReturnValue(
            createTurnResult(6, 0),
        );
        const attacker = createPlayer('player-1');
        const defender = createPlayer('player-2', { health: 2, maxHealth: 8 });
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

        service.resolveCombatRound(session, hooks);

        expect(defender.health).toBe(8);
    });

    it('restores the pre-combat turn timer when combat ends and the initiator keeps the turn', () => {
        combatResolutionServiceMock.resolveCombatTurnSimultaneous = jest.fn().mockReturnValue(
            createTurnResult(6, 0),
        );
        const attacker = createPlayer('player-1');
        const defender = createPlayer('player-2');
        const session = createSession([attacker, defender], {
            activePlayerId: 'player-1',
            countdownMode: 'combat',
            turnRemainingSeconds: PRE_COMBAT_TURN_SECONDS,
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });
        const hooks = createHooks();

        service.startCombat(session, 'player-1', 'player-2', hooks);
        service.resolveCombatRound(session, hooks);

        expect(session.combatState).toBeUndefined();
        expect(session.countdownMode).toBe('turn');
        expect(session.turnRemainingSeconds).toBe(PRE_COMBAT_TURN_SECONDS);
    });

    it('restores transition countdown mode when combat ends during transition phase', () => {
        const attacker = createPlayer('player-1');
        const defender = createPlayer('player-2');
        const session = createSession([attacker, defender], {
            phase: 'transition',
            countdownMode: 'transition',
            turnRemainingSeconds: PRE_COMBAT_TURN_SECONDS,
        });
        const hooks = createHooks();

        service.startCombat(session, 'player-1', 'player-2', hooks);
        service.endCombat(session);

        expect(session.combatState).toBeUndefined();
        expect(session.countdownMode).toBe('transition');
        expect(session.countdownCombatPlayerIds).toEqual([]);
        expect(session.turnRemainingSeconds).toBe(COMBAT_TURN_DURATION_SECONDS);
    });

    it('resolves the combat round at timeout when no posture is chosen', () => {
        combatResolutionServiceMock.resolveCombatTurnSimultaneous = jest.fn().mockReturnValue(
            createTurnResult(6, 0),
        );
        const session = createSession([createPlayer('player-1'), createPlayer('player-2')], {
            countdownMode: 'combat',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });
        const hooks = createHooks();

        service.resolveCombatRound(session, hooks);

        expect(session.combatState).toBeUndefined();
        expect(session.players[0].combatsWon).toBe(1);
    });

    it('ends combat without winner when one combatant is missing', () => {
        const session = createSession([createPlayer('player-1'), createPlayer('player-2')], {
            countdownMode: 'combat',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });
        const hooks = createHooks();
        session.players[1].hasAbandoned = true;

        service.resolveCombatRound(session, hooks);

        expect(session.combatState).toBeUndefined();
        expect(hooks.emitCombatEnd).not.toHaveBeenCalled();
    });

    it('does nothing when resolving combat without an active combat state', () => {
        const session = createSession([createPlayer('player-1'), createPlayer('player-2')]);
        const hooks = createHooks();

        service.resolveCombatRound(session, hooks);

        expect(hooks.emitCombatEnd).not.toHaveBeenCalled();
        expect(session.messages).toEqual([]);
    });
});

