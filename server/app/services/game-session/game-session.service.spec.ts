import { CombatResolutionService } from '@app/services/combat/combat-resolution.service';
import { PlayerService } from '@app/services/player/player.service';
import { CombatPosture } from '@common/combat';
import { DoorState, ObjectId, TileId } from '@common/game';
import { DEFAULT_GAME_TURN_COUNTDOWN, DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN, GameSessionState } from '@common/game-session';
import { PlayerType } from '@common/player';
import { Test, TestingModule } from '@nestjs/testing';
import { GameSessionService } from './game-session.service';
import {
    EXTRA_TICK,
    ONE_SECOND_MS,
    createPlayerServiceMock,
    ctfGame,
    fourPlayerCtfGame,
    fourPlayerRoomState,
    game,
    roomState,
} from './game-session.service.spec.utils';

/**
 * Portee :
 * - orchestration du cycle de vie dans GameSessionService (création, minuterie, visibilité, abandon)
 * Cas limites :
 * - nombre insuffisant de cases de départ
 * - chemins d'annulation CTF/classique
 * - comportement d'abandon hote/joueur virtuel
 */
/**
 * Strategie :
 * - tester GameSessionService sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('GameSessionService', () => {
    let service: GameSessionService;
    let playerServiceMock: ReturnType<typeof createPlayerServiceMock>;
    let combatResolutionServiceMock: Pick<
        CombatResolutionService,
        'resolveCombatTurnSimultaneous' | 'rollDice' | 'getPostureBonus' | 'getTerrainPenalty'
    >;

    const startFirstTurn = () => {
        jest.advanceTimersByTime(DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN * ONE_SECOND_MS);
    };

    const createSessionAndTrackUpdates = (useCtfGame = false) => {
        let latestSession: GameSessionState | undefined;

        service.createSession(roomState, useCtfGame ? ctfGame : game, (sessionState) => {
            latestSession = { ...sessionState, players: [...sessionState.players], messages: [...sessionState.messages] };
        });

        return { getLatestSession: () => latestSession };
    };

    beforeEach(async () => {
        jest.useFakeTimers();
        playerServiceMock = createPlayerServiceMock();
        combatResolutionServiceMock = {
            resolveCombatTurnSimultaneous: jest.fn().mockReturnValue({
                attackerToDefender: {
                    attackerId: 'player-1',
                    defenderId: 'player-2',
                    attackerPosture: CombatPosture.Neutral,
                    attackerAttackBase: 4,
                    attackerAttackPostureBonus: 0,
                    attackerAttackDiceRoll: 1,
                    attackerAttackPenalty: 0,
                    attackerAttackTotal: 5,
                    defenderPosture: CombatPosture.Neutral,
                    defenderDefenseBase: 4,
                    defenderDefensePostureBonus: 0,
                    defenderDefenseDiceRoll: 1,
                    defenderDefensePenalty: 0,
                    defenderDefenseTotal: 5,
                    damageDealt: 0,
                    defenderHealthAfter: 0,
                },
                defenderToAttacker: {
                    attackerId: 'player-2',
                    defenderId: 'player-1',
                    attackerPosture: CombatPosture.Neutral,
                    attackerAttackBase: 4,
                    attackerAttackPostureBonus: 0,
                    attackerAttackDiceRoll: 1,
                    attackerAttackPenalty: 0,
                    attackerAttackTotal: 5,
                    defenderPosture: CombatPosture.Neutral,
                    defenderDefenseBase: 4,
                    defenderDefensePostureBonus: 0,
                    defenderDefenseDiceRoll: 1,
                    defenderDefensePenalty: 0,
                    defenderDefenseTotal: 5,
                    damageDealt: 0,
                    defenderHealthAfter: 5,
                },
                attackerHealthAfter: 5,
                defenderHealthAfter: 0,
                damageToDefender: 0,
                damageToAttacker: 0,
            } as never),
            rollDice: jest.fn().mockReturnValue(0),
            getPostureBonus: jest.fn().mockReturnValue(0),
            getTerrainPenalty: jest.fn().mockReturnValue(0),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GameSessionService,
                { provide: CombatResolutionService, useValue: combatResolutionServiceMock },
                { provide: PlayerService, useValue: playerServiceMock },
            ],
        }).compile();

        service = module.get<GameSessionService>(GameSessionService);
    });

    afterEach(() => {
        jest.useRealTimers();
        service.removeSession(roomState.roomId);
    });

    it('emits a countdown update every second', () => {
        const updatedSessions: GameSessionState[] = [];

        service.createSession(roomState, game, (session) => {
            updatedSessions.push({ ...session });
        });

        jest.advanceTimersByTime(ONE_SECOND_MS);

        expect(updatedSessions).toHaveLength(EXTRA_TICK);
        expect(updatedSessions[0].phase).toBe('transition');
        expect(updatedSessions[0].countdownMode).toBe('transition');
        expect(updatedSessions[0].turnRemainingSeconds).toBe(DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN - EXTRA_TICK);
        expect(updatedSessions[0].activePlayerId).toBe('player-1');
    });

    it('starts the first turn after the initial transition', () => {
        const { getLatestSession } = createSessionAndTrackUpdates();
        startFirstTurn();
        const latestSession = getLatestSession();

        expect(latestSession).toBeDefined();
        expect(latestSession?.turnRemainingSeconds).toBe(DEFAULT_GAME_TURN_COUNTDOWN);
        expect(latestSession?.activePlayerId).toBe('player-1');
        expect(latestSession?.phase).toBe('turn');
        expect(latestSession?.countdownMode).toBe('turn');
    });

    it('propagates combat sanctuary points in the session', () => {
        const session = service.createSession(roomState, game, () => undefined);

        expect(session.players[0].combatSanctuaryPointsLeft).toBe(0);
        expect(session.players[1].combatSanctuaryPointsLeft).toBe(0);
    });

    it('does not assign teams in a classic game', () => {
        const session = service.createSession(roomState, game, () => undefined);

        expect(session.players.every((p) => p.team === undefined)).toBe(true);
    });

    it('starts with an empty journal when the session is created', () => {
        const session = service.createSession(roomState, ctfGame, () => undefined);

        expect(session.messages).toEqual([]);
    });

    it('returns a session view filtered by journal visibility', () => {
        const session = service.createSession(roomState, game, () => undefined);
        session.messages = [
            ...session.messages,
            {
                id: 'public-entry',
                text: 'Un evenement public.',
                type: 'system',
                createdAt: new Date(0).toISOString(),
                eventType: 'generic',
                audience: 'all',
                involvedPlayerIds: [],
            },
            {
                id: 'private-entry',
                text: 'Un evenement de combat prive.',
                type: 'combat',
                createdAt: new Date(1).toISOString(),
                eventType: 'combat-round',
                audience: 'players',
                visibleToPlayerIds: ['player-1', 'player-2'],
                involvedPlayerIds: ['player-1', 'player-2'],
            },
        ];

        const playerView = service.getSessionView(roomState.roomId, 'player-1');
        const spectatorView = service.getSessionView(roomState.roomId, 'spectator');

        expect(playerView?.messages.map((message) => message.id)).toContain('private-entry');
        expect(spectatorView?.messages.map((message) => message.id)).not.toContain('private-entry');
        expect(spectatorView?.messages.map((message) => message.id)).toContain('public-entry');
    });

    it('refuses to create a session when start points are insufficient', () => {
        playerServiceMock.createSessionPlayers.mockImplementationOnce(() => {
            throw new Error('Nombre insuffisant de points de départ pour initialiser tous les joueurs.');
        });

        expect(() => service.createSession(roomState, game, () => undefined)).toThrow(
            'Nombre insuffisant de points de départ pour initialiser tous les joueurs.',
        );
    });

    it('moves to the next player after turn end and next transition', () => {
        const { getLatestSession } = createSessionAndTrackUpdates();
        startFirstTurn();
        jest.advanceTimersByTime(DEFAULT_GAME_TURN_COUNTDOWN * ONE_SECOND_MS);
        const latestSession = getLatestSession();

        expect(latestSession).toBeDefined();
        expect(latestSession?.turnRemainingSeconds).toBe(DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN);
        expect(latestSession?.activePlayerId).toBe('player-2');
        expect(latestSession?.phase).toBe('transition');
        expect(latestSession?.countdownMode).toBe('transition');
    });

    it('marks a player as abandoned and passes the turn when needed', () => {
        let latestSession: GameSessionState | undefined;
        service.createSession(fourPlayerRoomState, fourPlayerCtfGame, (s) => {
            latestSession = { ...s, players: [...s.players], messages: [...s.messages] };
        });

        const result = service.abandonPlayer(fourPlayerRoomState.roomId, 'player-1');
        const updatedSession = result.session;

        expect(updatedSession).toBeDefined();
        expect(result.cancellationMessage).toBeUndefined();
        expect(updatedSession?.players[0].hasAbandoned).toBe(true);
        expect(updatedSession?.activePlayerId).toBe('player-2');
        expect(updatedSession?.turnRemainingSeconds).toBe(DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN);
        expect(updatedSession?.phase).toBe('transition');
        expect(updatedSession?.countdownMode).toBe('transition');
        expect(updatedSession?.messages.at(-1)?.text).toBe('Joueur 1 a abandonne la partie.');
        expect(updatedSession?.messages.at(-1)).toMatchObject({ eventType: 'abandon', involvedPlayerIds: ['player-1'], audience: 'all' });
        expect(latestSession?.activePlayerId).toBe('player-2');
    });

    it('drops the flag on the nearest free terrain tile when a player abandons while holding it', () => {
        const ctfGameWithFlagDoor = {
            ...fourPlayerCtfGame,
            cells: [
                { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
                { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Start },
                { row: 1, column: 0, tile: TileId.Base, object: ObjectId.Start },
                { row: 1, column: 1, tile: TileId.Base, object: ObjectId.Start },
                { row: 0, column: 2, tile: TileId.Door, doorState: DoorState.Open },
                { row: 1, column: 2, tile: TileId.Base, object: ObjectId.Heal },
                { row: 2, column: 2, tile: TileId.Wall },
                { row: 0, column: 3, tile: TileId.Base },
            ],
        };
        service.createSession(fourPlayerRoomState, ctfGameWithFlagDoor, () => undefined);
        const sessionBefore = service.getSession(fourPlayerRoomState.roomId);
        if (!sessionBefore) {
            throw new Error('Expected active session');
        }

        const abandoningPlayer = sessionBefore.players.find((player) => player.id === 'player-1');
        if (!abandoningPlayer) {
            throw new Error('Expected player-1');
        }

        abandoningPlayer.hasFlag = true;
        abandoningPlayer.position = { row: 0, column: 2 };

        const result = service.abandonPlayer(fourPlayerRoomState.roomId, 'player-1');
        const droppedFlagCell = result.session?.cells.find((cell) => cell.object === ObjectId.Flag);

        expect(result.session?.players.find((player) => player.id === 'player-1')?.hasFlag).toBe(false);
        expect(droppedFlagCell).toBeDefined();
        expect(droppedFlagCell?.tile).toBe(TileId.Base);
        expect(droppedFlagCell?.doorState).toBeUndefined();
        expect(result.session?.cells.find((cell) => cell.row === 0 && cell.column === 2)?.object).toBeUndefined();
    });

    it('does not abandon a virtual player', () => {
        service.createSession(fourPlayerRoomState, fourPlayerCtfGame, () => undefined);
        const sessionBefore = service.getSession(fourPlayerRoomState.roomId);
        const virtualPlayer = sessionBefore?.players.find((player) => player.id === 'player-1');
        if (!virtualPlayer) {
            throw new Error('Expected player-1');
        }
        virtualPlayer.playerType = PlayerType.VirtualPlayer;

        const result = service.abandonPlayer(fourPlayerRoomState.roomId, 'player-1');

        expect(result.session?.players.find((player) => player.id === 'player-1')?.hasAbandoned).toBe(false);
        expect(result.session?.messages.filter((message) => message.eventType === 'abandon')).toHaveLength(0);
    });

    it('cancels a CTF game when the last player of a team abandons', () => {
        service.createSession(roomState, ctfGame, () => undefined);

        const result = service.abandonPlayer(roomState.roomId, 'player-1');

        expect(result.cancellationMessage).toBe("La partie CTF est annulée, car une équipe n'a plus de joueurs.");
        expect(service.getSession(roomState.roomId)).toBeUndefined();
    });

    it('cancels a CTF game when no human player remains active', () => {
        service.createSession(fourPlayerRoomState, fourPlayerCtfGame, () => undefined);
        const session = service.getSession(fourPlayerRoomState.roomId);
        if (!session) {
            throw new Error('Expected CTF session');
        }

        const player1 = session.players.find((player) => player.id === 'player-1');
        const player2 = session.players.find((player) => player.id === 'player-2');
        const player3 = session.players.find((player) => player.id === 'player-3');
        const player4 = session.players.find((player) => player.id === 'player-4');
        if (!player1 || !player2 || !player3 || !player4) {
            throw new Error('Expected 4 players in session');
        }

        player1.playerType = PlayerType.HumanPlayer;
        player2.playerType = PlayerType.VirtualPlayer;
        player3.playerType = PlayerType.VirtualPlayer;
        player4.playerType = PlayerType.VirtualPlayer;

        const result = service.abandonPlayer(fourPlayerRoomState.roomId, 'player-1');

        expect(result.cancellationMessage).toBe('La partie est annulée, car il ne reste aucun joueur humain en jeu.');
        expect(service.getSession(fourPlayerRoomState.roomId)).toBeUndefined();
    });

    it('immediately cancels a classic game when only one player remains', () => {
        service.createSession(roomState, game, () => undefined);

        const result = service.abandonPlayer(roomState.roomId, 'player-1');

        expect(result.cancellationMessage).toBe('La partie classique est annulée, car il ne reste qu un seul joueur en jeu.');
        expect(service.getSession(roomState.roomId)).toBeUndefined();
    });

    it('disables debug mode when the host abandons the game', () => {
        service.createSession(roomState, ctfGame, () => undefined);
        service.toggleDebugMode(roomState.roomId);

        const result = service.abandonPlayer(roomState.roomId, 'player-1');

        expect(result.session?.debugMode).toBe(false);
        expect(result.session?.messages.some((message) => message.text === 'Le mode debogage est desactive.')).toBe(true);
    });
});
