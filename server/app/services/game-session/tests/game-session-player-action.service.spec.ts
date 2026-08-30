import { Games } from '@app/model/database/game';
import { CombatResolutionService } from '@app/services/combat/combat-resolution.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import {
    ONE_SECOND_MS,
    createPlayerServiceMock,
    ctfGame,
    game,
    roomState,
} from '@app/services/game-session/game-session.service.spec.utils';
import { PlayerService } from '@app/services/player/player.service';
import { CombatPosture } from '@common/combat';
import { DoorState, ObjectId, TileId } from '@common/game';
import { DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN, GameSessionState } from '@common/game-session';
import { Test, TestingModule } from '@nestjs/testing';

const COMBAT_TARGET_POSITION = { row: 2, column: 3 };
const INVALID_COMBAT_TARGET_POSITION = { row: 5, column: 5 };

/**
 * Portee :
 * - chemins d'actions joueur exposes par GameSessionService
 * Cas limites :
 * - cibles de combat invalides
 * - contraintes d'une action par tour
 * - téléportation debug et interactions spécifiques CTF
 */
/**
 * Strategie :
 * - tester GameSessionService player actions sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('GameSessionService player actions', () => {
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

    it('does not pick up the flag when moving onto a flag tile in classic mode', () => {
        const classicGameWithFlag: Games = {
            ...game,
            cells: [
                { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
                { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Start },
                { row: 1, column: 0, tile: TileId.Base, object: ObjectId.Flag },
                { row: 1, column: 1, tile: TileId.Base },
            ],
        };

        service.createSession(roomState, classicGameWithFlag, () => undefined);
        startFirstTurn();

        playerServiceMock.tryMoveActivePlayer.mockImplementation((sessionState) => {
            sessionState.players[0].position = { row: 1, column: 0 };
            return true;
        });

        const updatedSession = service.movePlayer(roomState.roomId, 'player-1', { row: 1, column: 0 });

        expect(updatedSession?.players[0].hasFlag).toBe(false);
        expect(updatedSession?.cells.find((cell) => cell.row === 1 && cell.column === 0)?.object).toBe(ObjectId.Flag);
        expect(updatedSession?.messages.some((message) => message.text.includes('ramasse le drapeau'))).toBe(false);
    });

    it('does not create a pending flag transfer in classic mode', () => {
        service.createSession(roomState, game, () => undefined);
        startFirstTurn();

        const session = service.getSession(roomState.roomId);
        if (!session) {
            throw new Error('Session should exist');
        }

        const activePlayer = session.players.find((player) => player.id === 'player-1');
        const teammate = session.players.find((player) => player.id === 'player-2');
        if (!activePlayer || !teammate) {
            throw new Error('Expected player-1 and player-2 in session');
        }

        activePlayer.team = 'A';
        teammate.team = 'A';
        activePlayer.position = { row: 5, column: 5 };
        teammate.position = { row: 5, column: 6 };
        activePlayer.hasFlag = true;

        service.performAction(roomState.roomId, 'player-1', { row: 5, column: 6 });

        expect(service.getPendingFlagTransfer(roomState.roomId)).toBeUndefined();
        expect(session.messages.some((message) => message.text.includes('propose un transfert du drapeau'))).toBe(false);
    });

    it('allows combat between same-team players in classic mode', () => {
        service.createSession(roomState, game, () => undefined);
        startFirstTurn();

        const session = service.getSession(roomState.roomId);
        if (!session) {
            throw new Error('Session should exist');
        }

        const attacker = session.players.find((player) => player.id === 'player-1');
        const defender = session.players.find((player) => player.id === 'player-2');
        if (!attacker || !defender) {
            throw new Error('Expected player-1 and player-2 in session');
        }

        attacker.team = 'A';
        defender.team = 'A';
        attacker.position = { row: 0, column: 0 };
        defender.position = { row: 0, column: 1 };

        playerServiceMock.tryPerformCombatAction.mockReturnValue({ id: 'player-2', name: 'Joueur 2' });

        const updatedSession = service.performAction(roomState.roomId, 'player-1', { row: 0, column: 1 });

        expect(updatedSession?.countdownMode).toBe('combat');
        expect(updatedSession?.combatState).toBeDefined();
        expect(updatedSession?.messages.some((message) => message.eventType === 'combat-start')).toBe(true);
    });

    it('awards a combat victory and consumes the action when the target is valid', () => {
        const { getLatestSession } = createSessionAndTrackUpdates();
        startFirstTurn();
        const currentSession = service.getSession(roomState.roomId);
        if (!currentSession) {
            throw new Error('Session should exist');
        }
        currentSession.players[0].combatsWon = 2;

        service.performAction(roomState.roomId, 'player-1', COMBAT_TARGET_POSITION);
        service.chooseCombatPosture(roomState.roomId, 'player-1', CombatPosture.Offensive);
        const updatedSession = service.chooseCombatPosture(roomState.roomId, 'player-2', CombatPosture.Defensive);
        const latestSession = getLatestSession();

        expect(updatedSession).toBeDefined();
        expect(latestSession).toBeDefined();
        expect(updatedSession?.players[0].actionsLeft).toBe(0);
        expect(updatedSession?.players[0].combatsWon).toBe(3);
        expect(updatedSession?.winnerPlayerId).toBe('player-1');
        expect(updatedSession?.countdownMode).toBe('disabled');
        expect(latestSession?.players[0].actionsLeft).toBe(0);
        expect(latestSession?.winnerPlayerId).toBe('player-1');
    });

    it('does not award victory or consume the action when the combat target is invalid', () => {
        service.createSession(roomState, game, () => undefined);
        startFirstTurn();

        playerServiceMock.tryPerformCombatAction.mockReturnValue(null);

        const updatedSession = service.performAction(roomState.roomId, 'player-1', INVALID_COMBAT_TARGET_POSITION);

        expect(playerServiceMock.tryPerformCombatAction).toHaveBeenCalledWith(
            expect.objectContaining({ activePlayerId: 'player-1' }),
            'player-1',
            INVALID_COMBAT_TARGET_POSITION,
        );
        expect(updatedSession?.players[0].actionsLeft).toBe(1);
        expect(updatedSession?.players[0].combatsWon).toBe(0);
    });

    it('opens an adjacent closed door, consumes one action and logs the interaction', () => {
        const gameWithClosedDoor: Games = {
            ...game,
            cells: [
                { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
                { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Start },
                { row: 1, column: 0, tile: TileId.Door, doorState: DoorState.Closed },
                { row: 1, column: 1, tile: TileId.Base },
            ],
        };

        service.createSession(roomState, gameWithClosedDoor, () => undefined);
        startFirstTurn();
        const initialSession = service.getSession(roomState.roomId);
        if (!initialSession) {
            throw new Error('Session should exist');
        }
        initialSession.players[0].position = { row: 0, column: 0 };

        const updatedSession = service.performAction(roomState.roomId, 'player-1', { row: 1, column: 0 });
        const updatedDoor = updatedSession?.cells.find((cell) => cell.row === 1 && cell.column === 0);

        expect(updatedDoor?.doorState).toBe(DoorState.Open);
        expect(updatedSession?.players[0].actionsLeft).toBe(0);
        expect(updatedSession?.messages.at(-1)?.text).toBe('Joueur 1 ouvre une porte.');
        expect(updatedSession?.messages.at(-1)?.type).toBe('player');
        expect(updatedSession?.messages.at(-1)).toMatchObject({ eventType: 'door', involvedPlayerIds: ['player-1'] });
        expect(playerServiceMock.tryPerformCombatAction).not.toHaveBeenCalled();
    });

    it('starts a combat state after a combat action', () => {
        const { getLatestSession } = createSessionAndTrackUpdates();
        startFirstTurn();
        playerServiceMock.hasAvailableMove.mockReturnValue(false);
        playerServiceMock.hasAvailableCombatAction.mockReturnValue(false);

        const updatedSession = service.performAction(roomState.roomId, 'player-1', COMBAT_TARGET_POSITION);

        expect(updatedSession?.activePlayerId).toBe('player-1');
        expect(updatedSession?.phase).toBe('turn');
        expect(updatedSession?.countdownMode).toBe('combat');
        expect(updatedSession?.combatState).toBeDefined();
        expect(updatedSession?.countdownCombatPlayerIds).toContain('player-1');
        expect(updatedSession?.countdownCombatPlayerIds).toContain('player-2');
        expect(updatedSession?.messages.at(-1)).toMatchObject({ eventType: 'combat-start', involvedPlayerIds: ['player-1', 'player-2'] });
        expect(getLatestSession()?.countdownMode).toBe('combat');
    });

    it('resolves the combat round immediately once both postures are selected', () => {
        service.createSession(roomState, game, () => undefined);
        startFirstTurn();

        const startedCombat = service.performAction(roomState.roomId, 'player-1', COMBAT_TARGET_POSITION);
        expect(startedCombat?.countdownMode).toBe('combat');
        expect(startedCombat?.combatState).toBeDefined();

        const afterAttackerChoice = service.chooseCombatPosture(roomState.roomId, 'player-1', CombatPosture.Offensive);
        expect(afterAttackerChoice?.combatState?.attackerPosture).toBe(CombatPosture.Offensive);
        expect(afterAttackerChoice?.countdownMode).toBe('combat');

        const afterDefenderChoice = service.chooseCombatPosture(roomState.roomId, 'player-2', CombatPosture.Defensive);
        expect(afterDefenderChoice?.combatState).toBeUndefined();
        expect(afterDefenderChoice?.players[0].combatsWon).toBe(1);
    });

    it('teleports the active player without consuming movement when debug mode is active', () => {
        service.createSession(roomState, game, () => undefined);
        startFirstTurn();
        service.toggleDebugMode(roomState.roomId);
        playerServiceMock.tryTeleportActivePlayer.mockImplementation((session, playerId, payload) => {
            const player = session.players.find(({ id }) => id === playerId);
            if (!player) {
                return false;
            }

            player.position = { row: payload.row, column: payload.column };
            return true;
        });

        const updatedSession = service.teleportPlayer(roomState.roomId, 'player-1', { row: 1, column: 0 });

        expect(updatedSession?.players[0].position).toEqual({ row: 1, column: 0 });
        expect(updatedSession?.players[0].movementPointsLeft).toBe(roomState.players[0].character.movementPointsLeft);
        expect(playerServiceMock.tryTeleportActivePlayer).toHaveBeenCalledWith(
            expect.objectContaining({ activePlayerId: 'player-1', debugMode: true }),
            'player-1',
            { row: 1, column: 0 },
        );
    });

    it('does not teleport when debug mode is inactive', () => {
        service.createSession(roomState, game, () => undefined);
        startFirstTurn();
        const session = service.getSession(roomState.roomId);
        const initialPosition = session ? { ...session.players[0].position } : undefined;

        const updatedSession = service.teleportPlayer(roomState.roomId, 'player-1', { row: 1, column: 0 });

        expect(updatedSession?.players[0].position).toEqual(initialPosition);
        expect(playerServiceMock.tryTeleportActivePlayer).not.toHaveBeenCalled();
    });
});


