import { GameSessionSanctuaryService } from '@app/services/game-session/sub-services/game-session-sanctuary.service';
import {
    createAppendMessageMock,
    createTestSession as createBaseSession,
    createTestPlayer as createPlayer,
} from '@app/services/game-session/tests/game-session-sub-services.spec.utils';
import { GameSessionTurnHooks, GameSessionTurnService } from '@app/services/game-session/utils/game-session-turn.service';
import { PlayerService } from '@app/services/player/player.service';
import { DoorState, ObjectId, TileId } from '@common/game';
import { DEFAULT_GAME_TURN_COUNTDOWN, DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN, GameSessionPlayer, GameSessionState } from '@common/game-session';

const TURN_TEST_CELLS: GameSessionState['cells'] = [
    { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
    { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Start },
    { row: 1, column: 0, tile: TileId.Base },
    { row: 1, column: 1, tile: TileId.Door, doorState: DoorState.Closed },
];

const createSession = (
    players: GameSessionPlayer[],
    overrides: Partial<GameSessionState> = {},
    cells: GameSessionState['cells'] = TURN_TEST_CELLS,
): GameSessionState => createBaseSession(players, overrides, cells);

const createHooks = (): GameSessionTurnHooks & {
    resolveCombatRound: jest.Mock;
    endCombat: jest.Mock;
    expirePendingTransfer: jest.Mock;
    appendMessage: jest.Mock;
    canCloseDoor: jest.Mock;
} => ({
    canCloseDoor: jest.fn().mockReturnValue(true),
    resolveCombatRound: jest.fn(),
    endCombat: jest.fn(),
    expirePendingTransfer: jest.fn(),
    appendMessage: createAppendMessageMock(),
});

/**
 * Portee :
 * - transitions du service de tour et logique de fin automatique
 * Cas limites :
 * - protections sans joueurs actifs / fin de partie
 * - flux de compte a rebours transition-vers-tour
 * - comportement de fin auto sans option
 */
/**
 * Strategie :
 * - tester GameSessionTurnService sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('GameSessionTurnService', () => {
    let service: GameSessionTurnService;
    let playerServiceMock: Pick<PlayerService, 'hasAvailableCombatAction' | 'hasAvailableMove' | 'resetTurnResources'>;
    let sanctuaryServiceMock: Pick<
        GameSessionSanctuaryService,
        'progressCombatSanctuaryEffect' | 'advanceShrineCooldowns' | 'canUseSanctuaryOnCell'
    >;

    beforeEach(() => {
        playerServiceMock = {
            hasAvailableCombatAction: jest.fn().mockReturnValue(false),
            hasAvailableMove: jest.fn().mockReturnValue(false),
            resetTurnResources: jest.fn(),
        };
        sanctuaryServiceMock = {
            progressCombatSanctuaryEffect: jest.fn(),
            advanceShrineCooldowns: jest.fn(),
            canUseSanctuaryOnCell: jest.fn().mockReturnValue(false),
        };

        service = new GameSessionTurnService(playerServiceMock as PlayerService, sanctuaryServiceMock as GameSessionSanctuaryService);
    });

    it('starts turn phase and resets active player resources', () => {
        const session = createSession(
            [createPlayer('player-1'), createPlayer('player-2')],
            {
                phase: 'transition',
                countdownMode: 'transition',
                activePlayerId: 'player-1',
            },
        );
        const hooks = createHooks();

        service.startTurn(session, hooks);

        expect(session.phase).toBe('turn');
        expect(session.countdownMode).toBe('turn');
        expect(session.turnRemainingSeconds).toBe(DEFAULT_GAME_TURN_COUNTDOWN);
        expect(playerServiceMock.resetTurnResources).toHaveBeenCalledWith(session.players[0], 1);
        expect(sanctuaryServiceMock.advanceShrineCooldowns).toHaveBeenCalledWith(session);
        expect(session.messages.at(-1)?.text).toBe('Le tour de Joueur player-1 commence.');
    });

    it('does not start turn when game is already over', () => {
        const session = createSession(
            [createPlayer('player-1'), createPlayer('player-2')],
            {
                winnerPlayerId: 'player-1',
                activePlayerId: 'player-1',
            },
        );
        const hooks = createHooks();

        service.startTurn(session, hooks);

        expect(playerServiceMock.resetTurnResources).not.toHaveBeenCalled();
        expect(sanctuaryServiceMock.advanceShrineCooldowns).not.toHaveBeenCalled();
        expect(hooks.appendMessage).not.toHaveBeenCalled();
    });

    it('moves to next non-abandoned player in transition', () => {
        const session = createSession(
            [
                createPlayer('player-1', { hasAbandoned: false }),
                createPlayer('player-2', { hasAbandoned: true }),
                createPlayer('player-3', { hasAbandoned: false }),
            ],
            {},
        );
        session.activePlayerId = 'player-1';

        service.startTransitionToNextTurn(session);

        expect(session.activePlayerId).toBe('player-3');
        expect(session.phase).toBe('transition');
        expect(session.countdownMode).toBe('transition');
        expect(session.turnRemainingSeconds).toBe(DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN);
    });

    it('completes turn, appends message and increments turn counter', () => {
        const activePlayer = createPlayer('player-1');
        const session = createSession([activePlayer, createPlayer('player-2')], { activePlayerId: 'player-1' });
        const hooks = createHooks();

        service.completeTurn(session, activePlayer, hooks);

        expect(hooks.expirePendingTransfer).toHaveBeenCalledWith(session);
        expect(sanctuaryServiceMock.progressCombatSanctuaryEffect).toHaveBeenCalledWith(activePlayer);
        expect(session.messages.at(-1)?.text).toBe('Joueur player-1 a termine son tour.');
        expect(session.activePlayerId).toBe('player-2');
        expect(session.phase).toBe('transition');
        expect(activePlayer.turnPlayed).toBe(1);
    });

    it('does not complete turn when game is already over', () => {
        const activePlayer = createPlayer('player-1');
        const session = createSession(
            [activePlayer, createPlayer('player-2')],
            {
                activePlayerId: 'player-1',
                winnerPlayerId: 'player-1',
            },
        );
        const hooks = createHooks();

        service.completeTurn(session, activePlayer, hooks);

        expect(hooks.expirePendingTransfer).not.toHaveBeenCalled();
        expect(hooks.appendMessage).not.toHaveBeenCalled();
        expect(session.activePlayerId).toBe('player-1');
    });

    it('completes turn if no combat action, non-combat action, or move is available', () => {
        const activePlayer = createPlayer('player-1', { position: { row: 0, column: 0 }, movementPointsLeft: 0, actionsLeft: 1 });
        const session = createSession([activePlayer, createPlayer('player-2')], { activePlayerId: 'player-1' });
        const hooks = createHooks();

        (playerServiceMock.hasAvailableCombatAction as jest.Mock).mockReturnValue(false);
        (playerServiceMock.hasAvailableMove as jest.Mock).mockReturnValue(false);
        (sanctuaryServiceMock.canUseSanctuaryOnCell as jest.Mock).mockReturnValue(false);

        service.completeTurnIfNoOptions(session, activePlayer, hooks);

        expect(session.activePlayerId).toBe('player-2');
        expect(session.phase).toBe('transition');
        expect(session.messages.at(-1)?.text).toBe('Joueur player-1 a termine son tour.');
    });

    it('does not complete turn when an adjacent combat action is available', () => {
        const activePlayer = createPlayer('player-1');
        const session = createSession([activePlayer, createPlayer('player-2')], {});
        const hooks = createHooks();

        (playerServiceMock.hasAvailableCombatAction as jest.Mock).mockReturnValue(true);

        service.completeTurnIfNoOptions(session, activePlayer, hooks);

        expect(session.activePlayerId).toBe('player-1');
        expect(hooks.appendMessage).not.toHaveBeenCalled();
    });

    it('does not complete turn when a closed adjacent door can be interacted with', () => {
        const activePlayer = createPlayer('player-1', { position: { row: 0, column: 0 }, actionsLeft: 1 });
        const session = createSession([activePlayer, createPlayer('player-2')], { activePlayerId: 'player-1' });
        session.cells = session.cells.map((cell) =>
            cell.row === 1 && cell.column === 0 ? { ...cell, tile: TileId.Door, doorState: DoorState.Closed } : cell,
        );
        const hooks = createHooks();

        (playerServiceMock.hasAvailableCombatAction as jest.Mock).mockReturnValue(false);
        (playerServiceMock.hasAvailableMove as jest.Mock).mockReturnValue(false);

        service.completeTurnIfNoOptions(session, activePlayer, hooks);

        expect(session.activePlayerId).toBe('player-1');
        expect(hooks.appendMessage).not.toHaveBeenCalled();
    });

    it('does not complete turn when movement is still available', () => {
        const activePlayer = createPlayer('player-1');
        const session = createSession([activePlayer, createPlayer('player-2')], {});
        const hooks = createHooks();

        (playerServiceMock.hasAvailableCombatAction as jest.Mock).mockReturnValue(false);
        (playerServiceMock.hasAvailableMove as jest.Mock).mockReturnValue(true);

        service.completeTurnIfNoOptions(session, activePlayer, hooks);

        expect(session.activePlayerId).toBe('player-1');
        expect(hooks.appendMessage).not.toHaveBeenCalled();
    });

    it('advances session phase by resolving combat when combat state is active', () => {
        const session = createSession(
            [createPlayer('player-1'), createPlayer('player-2')],
            {
                countdownMode: 'combat',
                combatState: {
                    attackerId: 'player-1',
                    defenderId: 'player-2',
                    currentTurnNumber: 1,
                    turnsHistory: [],
                },
            },
        );
        const hooks = createHooks();

        service.advanceSessionPhase(session, hooks);

        expect(hooks.resolveCombatRound).toHaveBeenCalledWith(session);
        expect(hooks.endCombat).not.toHaveBeenCalled();
    });
});

