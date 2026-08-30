import { GameSessionCtfHooks, GameSessionCtfService, PendingFlagTransfer } from '@app/services/game-session/sub-services/game-session-ctf.service';
import {
    createAppendMessageMock,
    createTestSession as createBaseSession,
    createTestPlayer as createPlayer,
} from '@app/services/game-session/tests/game-session-sub-services.spec.utils';
import { Mode, ObjectId, TileId } from '@common/game';
import { GameSessionPlayer, GameSessionState } from '@common/game-session';
import { PlayerType } from '@common/player';

const CTF_TEST_CELLS: GameSessionState['cells'] = [
    { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
    { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Start },
    { row: 1, column: 0, tile: TileId.Base, object: ObjectId.Flag },
    { row: 1, column: 1, tile: TileId.Base },
];

const createSession = (players: GameSessionPlayer[], overrides: Partial<GameSessionState> = {}): GameSessionState =>
    createBaseSession(players, overrides, CTF_TEST_CELLS);

const createHooks = () => {
    const pendingTransfers = new Map<string, PendingFlagTransfer>();
    const spawnPositions = new Map<string, { row: number; column: number }>();

    const hooks: GameSessionCtfHooks & {
        emitSessionUpdate: jest.Mock;
        removeSession: jest.Mock;
    } = {
        appendMessage: createAppendMessageMock(),
        emitSessionUpdate: jest.fn(),
        removeSession: jest.fn(),
        hasPendingTransfer: jest.fn((roomId: string) => pendingTransfers.has(roomId)),
        setPendingTransfer: jest.fn((roomId: string, transfer: PendingFlagTransfer) => {
            pendingTransfers.set(roomId, transfer);
        }),
        clearPendingTransfer: jest.fn((roomId: string) => {
            pendingTransfers.delete(roomId);
        }),
        getSpawnPosition: jest.fn((playerId: string) => spawnPositions.get(playerId)),
    };

    return {
        hooks,
        getPendingTransfer: (roomId: string) => pendingTransfers.get(roomId),
        setSpawnPosition: (playerId: string, position: { row: number; column: number }) => spawnPositions.set(playerId, position),
    };
};

/**
 * Portee :
 * - comportement du sous-service CTF (equipes, ramassage, transfert, condition de victoire)
 * Cas limites :
 * - transferts en attente invalides ou dupliques
 * - contraintes de transfert pour joueurs virtuels
 * - contraintes de combat entre coequipiers en CTF
 */
/**
 * Strategie :
 * - tester GameSessionCtfService sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('GameSessionCtfService', () => {
    let service: GameSessionCtfService;

    beforeEach(() => {
        service = new GameSessionCtfService();
    });

    it('assigns players to two equal-size teams', () => {
        const players = [createPlayer('player-1'), createPlayer('player-2'), createPlayer('player-3'), createPlayer('player-4')];

        service.assignCtfTeams(players);

        expect(players.filter((player) => player.team === 'A')).toHaveLength(2);
        expect(players.filter((player) => player.team === 'B')).toHaveLength(2);
    });

    it('assigns an extra player to team A when team count is odd', () => {
        const players = [createPlayer('player-1'), createPlayer('player-2'), createPlayer('player-3')];

        service.assignCtfTeams(players);

        expect(players.filter((player) => player.team === 'A')).toHaveLength(2);
        expect(players.filter((player) => player.team === 'B')).toHaveLength(1);
    });

    it('picks up the flag when a player is on the flag tile in CTF', () => {
        const player = createPlayer('player-1', { position: { row: 1, column: 0 } });
        const session = createSession([player, createPlayer('player-2')]);
        const { hooks } = createHooks();

        service.tryPickUpFlag(Mode.CTF, session, player, hooks);

        expect(player.hasFlag).toBe(true);
        expect(player.hasHeldFlag).toBe(true);
        expect(session.cells.find((cell) => cell.row === 1 && cell.column === 0)?.object).toBeUndefined();
        expect(session.messages.at(-1)).toMatchObject({ eventType: 'flag', involvedPlayerIds: ['player-1'] });
    });

    it('does not pick up the flag when the player already has it', () => {
        const player = createPlayer('player-1', { hasFlag: true, position: { row: 1, column: 0 } });
        const session = createSession([player, createPlayer('player-2')]);
        const { hooks } = createHooks();

        service.tryPickUpFlag(Mode.CTF, session, player, hooks);

        expect(session.cells.find((cell) => cell.row === 1 && cell.column === 0)?.object).toBe(ObjectId.Flag);
        expect(hooks.appendMessage).not.toHaveBeenCalled();
    });

    it('creates a pending transfer when adjacent teammates can exchange the flag', () => {
        const activePlayer = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 5, column: 5 } });
        const teammate = createPlayer('player-2', { team: 'A', hasFlag: false, position: { row: 5, column: 6 } });
        const session = createSession([activePlayer, teammate]);
        const { hooks, getPendingTransfer } = createHooks();

        const started = service.tryExchangeFlagWithTeammate(
            {
                roomId: 'ROOM01',
                mode: Mode.CTF,
                session,
                activePlayer,
                target: { row: 5, column: 6 },
            },
            hooks,
        );

        expect(started).toBe(true);
        expect(getPendingTransfer('ROOM01')).toMatchObject({ initiatorId: 'player-1', teammateId: 'player-2' });
        expect(session.messages.at(-1)?.text).toContain('propose un transfert du drapeau');
    });

    it('does not create a pending transfer when another one already exists', () => {
        const activePlayer = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 5, column: 5 } });
        const teammate = createPlayer('player-2', { team: 'A', hasFlag: false, position: { row: 5, column: 6 } });
        const session = createSession([activePlayer, teammate]);
        const { hooks, getPendingTransfer } = createHooks();

        hooks.setPendingTransfer('ROOM01', {
            initiatorId: 'player-9',
            teammateId: 'player-10',
            target: { row: 0, column: 0 },
        });

        const started = service.tryExchangeFlagWithTeammate(
            {
                roomId: 'ROOM01',
                mode: Mode.CTF,
                session,
                activePlayer,
                target: { row: 5, column: 6 },
            },
            hooks,
        );

        expect(started).toBe(false);
        expect(getPendingTransfer('ROOM01')).toMatchObject({ initiatorId: 'player-9', teammateId: 'player-10' });
    });

    it('does not allow a virtual player to initiate a flag transfer', () => {
        const activePlayer = createPlayer('player-1', {
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            hasFlag: true,
            position: { row: 5, column: 5 },
        });
        const teammate = createPlayer('player-2', { team: 'A', position: { row: 5, column: 6 } });
        const session = createSession([activePlayer, teammate]);
        const { hooks, getPendingTransfer } = createHooks();

        const started = service.tryExchangeFlagWithTeammate(
            {
                roomId: 'ROOM01',
                mode: Mode.CTF,
                session,
                activePlayer,
                target: { row: 5, column: 6 },
            },
            hooks,
        );

        expect(started).toBe(false);
        expect(getPendingTransfer('ROOM01')).toBeUndefined();
        expect(session.messages.some((message) => message.text.includes('propose un transfert'))).toBe(false);
    });

    it('transfers the flag when the teammate accepts a valid pending transfer', () => {
        const activePlayer = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 5, column: 5 } });
        const teammate = createPlayer('player-2', { team: 'A', hasFlag: false, position: { row: 5, column: 6 } });
        const session = createSession([activePlayer, teammate], { activePlayerId: 'player-1' });
        const { hooks } = createHooks();
        const completeTurnIfNoOptions = jest.fn((_: GameSessionState, player: GameSessionPlayer) => {
            player.actionsLeft = 0;
        });

        service.tryExchangeFlagWithTeammate(
            {
                roomId: 'ROOM01',
                mode: Mode.CTF,
                session,
                activePlayer,
                target: { row: 5, column: 6 },
            },
            hooks,
        );

        const accepted = service.respondToFlagTransfer(
            {
                roomId: 'ROOM01',
                responderId: 'player-2',
                accepted: true,
                mode: Mode.CTF,
                session,
                pendingTransfer: { initiatorId: 'player-1', teammateId: 'player-2', target: { row: 5, column: 6 } },
            },
            hooks,
            completeTurnIfNoOptions,
        );

        expect(accepted).toBe(true);
        expect(activePlayer.hasFlag).toBe(false);
        expect(teammate.hasFlag).toBe(true);
        expect(teammate.hasHeldFlag).toBe(true);
        expect(activePlayer.actionsLeft).toBe(0);
        expect(session.messages.at(-1)?.text).toBe('Joueur player-1 passe le drapeau a Joueur player-2.');
        expect(hooks.emitSessionUpdate).toHaveBeenCalledWith('ROOM01', session);
    });

    it('returns false when transfer response has no pending transfer', () => {
        const activePlayer = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 5, column: 5 } });
        const teammate = createPlayer('player-2', { team: 'A', hasFlag: false, position: { row: 5, column: 6 } });
        const session = createSession([activePlayer, teammate]);
        const { hooks } = createHooks();

        const handled = service.respondToFlagTransfer(
            {
                roomId: 'ROOM01',
                responderId: 'player-2',
                accepted: true,
                mode: Mode.CTF,
                session,
                pendingTransfer: undefined,
            },
            hooks,
            jest.fn(),
        );

        expect(handled).toBe(false);
        expect(hooks.clearPendingTransfer).not.toHaveBeenCalled();
        expect(hooks.emitSessionUpdate).not.toHaveBeenCalled();
    });

    it('returns false when transfer response comes from a different player', () => {
        const activePlayer = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 5, column: 5 } });
        const teammate = createPlayer('player-2', { team: 'A', hasFlag: false, position: { row: 5, column: 6 } });
        const session = createSession([activePlayer, teammate]);
        const { hooks } = createHooks();

        const handled = service.respondToFlagTransfer(
            {
                roomId: 'ROOM01',
                responderId: 'player-3',
                accepted: true,
                mode: Mode.CTF,
                session,
                pendingTransfer: { initiatorId: 'player-1', teammateId: 'player-2', target: { row: 5, column: 6 } },
            },
            hooks,
            jest.fn(),
        );

        expect(handled).toBe(false);
        expect(hooks.clearPendingTransfer).not.toHaveBeenCalled();
        expect(hooks.emitSessionUpdate).not.toHaveBeenCalled();
    });

    it('cancels transfer when one player in pending transfer no longer exists', () => {
        const activePlayer = createPlayer('player-1', { team: 'A', hasFlag: true, hasAbandoned: true, position: { row: 5, column: 5 } });
        const teammate = createPlayer('player-2', { team: 'A', hasFlag: false, position: { row: 5, column: 6 } });
        const session = createSession([activePlayer, teammate]);
        const { hooks } = createHooks();

        const handled = service.respondToFlagTransfer(
            {
                roomId: 'ROOM01',
                responderId: 'player-2',
                accepted: true,
                mode: Mode.CTF,
                session,
                pendingTransfer: { initiatorId: 'player-1', teammateId: 'player-2', target: { row: 5, column: 6 } },
            },
            hooks,
            jest.fn(),
        );

        expect(handled).toBe(true);
        expect(session.messages.at(-1)?.text).toBe('Le transfert de drapeau est annule.');
        expect(hooks.emitSessionUpdate).toHaveBeenCalledWith('ROOM01', session);
    });

    it('invalidates transfer when teammate moved away before response', () => {
        const activePlayer = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 5, column: 5 } });
        const teammate = createPlayer('player-2', { team: 'A', hasFlag: false, position: { row: 5, column: 7 } });
        const session = createSession([activePlayer, teammate]);
        const { hooks } = createHooks();

        const handled = service.respondToFlagTransfer(
            {
                roomId: 'ROOM01',
                responderId: 'player-2',
                accepted: true,
                mode: Mode.CTF,
                session,
                pendingTransfer: { initiatorId: 'player-1', teammateId: 'player-2', target: { row: 5, column: 6 } },
            },
            hooks,
            jest.fn(),
        );

        expect(handled).toBe(true);
        expect(session.messages.at(-1)?.text).toBe('Le transfert de drapeau est devenu invalide.');
    });

    it('does not transfer the flag when the teammate refuses', () => {
        const activePlayer = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 5, column: 5 } });
        const teammate = createPlayer('player-2', { team: 'A', hasFlag: false, position: { row: 5, column: 6 } });
        const session = createSession([activePlayer, teammate]);
        const { hooks } = createHooks();

        const handled = service.respondToFlagTransfer(
            {
                roomId: 'ROOM01',
                responderId: 'player-2',
                accepted: false,
                mode: Mode.CTF,
                session,
                pendingTransfer: { initiatorId: 'player-1', teammateId: 'player-2', target: { row: 5, column: 6 } },
            },
            hooks,
            jest.fn(),
        );

        expect(handled).toBe(true);
        expect(activePlayer.hasFlag).toBe(true);
        expect(teammate.hasFlag).toBe(false);
        expect(session.messages.at(-1)?.text).toContain('refuse le transfert du drapeau');
    });

    it('automatically refuses the pending transfer when the turn ends without response', () => {
        const activePlayer = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 5, column: 5 } });
        const teammate = createPlayer('player-2', { team: 'A', hasFlag: false, position: { row: 5, column: 6 } });
        const session = createSession([activePlayer, teammate]);
        const { hooks } = createHooks();

        const handled = service.expirePendingTransfer(
            'ROOM01',
            session,
            { initiatorId: 'player-1', teammateId: 'player-2', target: { row: 5, column: 6 } },
            hooks,
        );

        expect(handled).toBe(true);
        expect(activePlayer.hasFlag).toBe(true);
        expect(teammate.hasFlag).toBe(false);
        expect(session.messages.at(-1)?.text).toContain('refuse automatiquement le transfert du drapeau');
        expect(hooks.clearPendingTransfer).toHaveBeenCalledWith('ROOM01');
    });

    it('ends the CTF game when the flag holder reaches their spawn point', () => {
        const flagHolder = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 0, column: 0 } });
        const teammate = createPlayer('player-2', { team: 'A', position: { row: 0, column: 1 } });
        const opponent = createPlayer('player-3', { team: 'B', position: { row: 1, column: 1 } });
        const session = createSession([flagHolder, teammate, opponent]);
        const { hooks, setSpawnPosition } = createHooks();
        setSpawnPosition('player-1', { row: 0, column: 0 });

        const ended = service.checkCtfWinCondition('ROOM01', Mode.CTF, session, flagHolder, hooks);

        expect(ended).toBe(true);
        expect(session.winnerPlayerId).toBe('player-1');
        expect(session.winnerPlayerIds).toEqual(['player-1', 'player-2']);
        expect(session.countdownMode).toBe('disabled');
        expect(session.turnRemainingSeconds).toBe(0);
        expect(session.messages.at(-1)?.text).toContain('ramene le drapeau');
        expect(hooks.removeSession).toHaveBeenCalledWith('ROOM01');
        expect(hooks.emitSessionUpdate).toHaveBeenCalledWith('ROOM01', session);
    });

    it('does not end CTF game when no spawn is found for the flag holder', () => {
        const flagHolder = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 0, column: 0 } });
        const teammate = createPlayer('player-2', { team: 'A', position: { row: 0, column: 1 } });
        const session = createSession([flagHolder, teammate]);
        const { hooks } = createHooks();

        const ended = service.checkCtfWinCondition('ROOM01', Mode.CTF, session, flagHolder, hooks);

        expect(ended).toBe(false);
        expect(session.winnerPlayerId).toBeUndefined();
        expect(hooks.removeSession).not.toHaveBeenCalled();
    });

    it('does not end CTF game when player is not on spawn', () => {
        const flagHolder = createPlayer('player-1', { team: 'A', hasFlag: true, position: { row: 1, column: 0 } });
        const session = createSession([flagHolder, createPlayer('player-2', { team: 'A' })]);
        const { hooks, setSpawnPosition } = createHooks();
        setSpawnPosition('player-1', { row: 0, column: 0 });

        const ended = service.checkCtfWinCondition('ROOM01', Mode.CTF, session, flagHolder, hooks);

        expect(ended).toBe(false);
        expect(session.winnerPlayerId).toBeUndefined();
        expect(hooks.removeSession).not.toHaveBeenCalled();
    });

    it('does not end CTF game when player does not hold the flag', () => {
        const player = createPlayer('player-1', { team: 'A', hasFlag: false, position: { row: 0, column: 0 } });
        const session = createSession([player, createPlayer('player-2', { team: 'A' })]);
        const { hooks, setSpawnPosition } = createHooks();
        setSpawnPosition('player-1', { row: 0, column: 0 });

        const ended = service.checkCtfWinCondition('ROOM01', Mode.CTF, session, player, hooks);

        expect(ended).toBe(false);
        expect(hooks.removeSession).not.toHaveBeenCalled();
    });

    it('does not trigger combat between teammates in CTF', () => {
        const attacker = createPlayer('player-1', { team: 'A' });
        const defender = createPlayer('player-2', { team: 'A' });

        const canTrigger = service.canTriggerCombatBetween(Mode.CTF, attacker, defender);

        expect(canTrigger).toBe(false);
    });

    it('allows combat between players of different teams in CTF', () => {
        const attacker = createPlayer('player-1', { team: 'A' });
        const defender = createPlayer('player-2', { team: 'B' });

        const canTrigger = service.canTriggerCombatBetween(Mode.CTF, attacker, defender);

        expect(canTrigger).toBe(true);
    });

    it('allows combat in CTF when one player has no team assigned', () => {
        const attacker = createPlayer('player-1', { team: 'A' });
        const defender = createPlayer('player-2', { team: undefined });

        const canTrigger = service.canTriggerCombatBetween(Mode.CTF, attacker, defender);

        expect(canTrigger).toBe(true);
    });

});
