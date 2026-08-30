import { GameSessionService } from '@app/services/game-session/game-session.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player.service';
import { GridSize, ObjectId, TileId } from '@common/game';
import { GameSessionState } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';
import { Playstyle, RoomState, VirtualPlayerSummary } from '@common/wait-room';
import { StrategyDecision } from './strategy/strategy';

describe('VirtualPlayerService', () => {
    let service: VirtualPlayerService;
    let gameSessionService: jest.Mocked<
        Pick<
            GameSessionService,
            'chooseCombatPosture' | 'endTurn' | 'getPendingFlagTransfer' | 'getSession' | 'movePlayer' | 'performAction' | 'respondToFlagTransfer'
        >
    >;

    const roomState: RoomState = {
        roomId: 'ROOM01',
        hostId: 'host-1',
        gameId: 'game-1',
        gameName: 'Jeu test',
        maxPlayers: 4,
        isLocked: false,
        mode: 'CTF',
        players: [
            {
                id: 'host-1',
                name: 'Host',
                avatar: { avatarName: AvatarName.Barbie, imageUrl: 'assets/characters/barbie.png' },
                playerType: PlayerType.HumanPlayer,
                character: {
                    health: 6,
                    maxHealth: 6,
                    speed: 4,
                    attack: 4,
                    defense: 4,
                    attackDice: 'D4',
                    defenseDice: 'D6',
                    movementPointsLeft: 4,
                    combatSanctuaryPointsLeft: 0,
                    actionsLeft: 1,
                },
            },
            {
                id: 'virtual-1',
                name: 'Botanix',
                avatar: { avatarName: AvatarName.Nikki, imageUrl: 'assets/characters/nikki.png' },
                playerType: PlayerType.VirtualPlayer,
                character: {
                    health: 6,
                    maxHealth: 6,
                    speed: 4,
                    attack: 4,
                    defense: 4,
                    attackDice: 'D4',
                    defenseDice: 'D6',
                    movementPointsLeft: 4,
                    combatSanctuaryPointsLeft: 0,
                    actionsLeft: 1,
                },
                playstyle: Playstyle.Defensive,
            } as VirtualPlayerSummary,
        ],
    };

    const sessionState: GameSessionState = {
        sessionId: 'ROOM01',
        roomId: 'ROOM01',
        gameId: 'game-1',
        gridSize: GridSize.Small,
        cells: [],
        players: [
            {
                id: 'host-1',
                name: 'Host',
                avatar: roomState.players[0].avatar,
                playerType: PlayerType.HumanPlayer,
                maxHealth: 6,
                health: 6,
                speed: 4,
                attack: 4,
                defense: 4,
                baseAttack: 4,
                baseDefense: 4,
                attackDice: 'D4',
                defenseDice: 'D6',
                movementPointsLeft: 4,
                combatSanctuaryPointsLeft: 0,
                actionsLeft: 1,
                combatsWon: 0,
                turnOrder: 1,
                isHost: true,
                hasAbandoned: false,
                hasFlag: true,
                team: 'A',
                spawnPosition: { row: 0, column: 0 },
                position: { row: 0, column: 0 },
            },
            {
                id: 'virtual-1',
                name: 'Botanix',
                avatar: roomState.players[1].avatar,
                playerType: PlayerType.VirtualPlayer,
                maxHealth: 6,
                health: 6,
                speed: 4,
                attack: 4,
                defense: 4,
                baseAttack: 4,
                baseDefense: 4,
                attackDice: 'D4',
                defenseDice: 'D6',
                movementPointsLeft: 4,
                combatSanctuaryPointsLeft: 0,
                actionsLeft: 1,
                combatsWon: 0,
                turnOrder: 2,
                isHost: false,
                hasAbandoned: false,
                hasFlag: false,
                team: 'A',
                spawnPosition: { row: 0, column: 1 },
                position: { row: 0, column: 1 },
            },
        ],
        activePlayerId: 'host-1',
        phase: 'turn',
        countdownMode: 'turn',
        countdownCombatPlayerIds: [],
        turnRemainingSeconds: 30,
        debugMode: false,
        messages: [],
    };

    beforeEach(() => {
        jest.useFakeTimers();
        gameSessionService = {
            chooseCombatPosture: jest.fn(),
            endTurn: jest.fn(),
            getPendingFlagTransfer: jest.fn(),
            getSession: jest.fn(),
            movePlayer: jest.fn(),
            performAction: jest.fn(),
            respondToFlagTransfer: jest.fn(),
        };

        service = new VirtualPlayerService(gameSessionService as unknown as GameSessionService);
        service.configureRoom(roomState);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('automatically accepts a pending flag transfer when the teammate is a virtual player', () => {
        gameSessionService.getPendingFlagTransfer
            .mockReturnValueOnce({
                initiatorId: 'host-1',
                teammateId: 'virtual-1',
                target: { row: 0, column: 1 },
            })
            .mockReturnValueOnce({
                initiatorId: 'host-1',
                teammateId: 'virtual-1',
                target: { row: 0, column: 1 },
            });
        gameSessionService.getSession.mockReturnValue(sessionState);

        service.onGameStateUpdate(sessionState);
        jest.runAllTimers();

        expect(gameSessionService.respondToFlagTransfer).toHaveBeenCalledWith('ROOM01', 'virtual-1', true);
    });

    it('ends the turn when a virtual player loops between the same tiles in one turn', () => {
        const oscillatingState: GameSessionState = {
            ...sessionState,
            phase: 'turn',
            countdownMode: 'turn',
            activePlayerId: 'virtual-1',
            players: sessionState.players.map((player) =>
                player.id === 'virtual-1'
                    ? {
                          ...player,
                          position: { row: 0, column: 1 },
                          movementPointsLeft: 0,
                          actionsLeft: 1,
                      }
                    : player,
            ),
        };

        gameSessionService.getPendingFlagTransfer.mockReturnValue(undefined);
        gameSessionService.getSession.mockImplementation(() => oscillatingState);
        gameSessionService.movePlayer.mockImplementation((_roomId, playerId, payload) => {
            const player = oscillatingState.players.find((candidate) => candidate.id === playerId);
            if (!player) {
                return undefined;
            }

            player.position = { row: payload.row, column: payload.column };
            return oscillatingState;
        });

        const oscillatingStrategy = {
            getId: () => 'virtual-1',
            process: (state: GameSessionState): StrategyDecision => {
                const player = state.players.find((candidate) => candidate.id === 'virtual-1');
                if (!player) {
                    return { type: 'none' };
                }

                if (player.position.column === 1) {
                    return { type: 'move', target: { row: 0, column: 2 } };
                }

                return { type: 'move', target: { row: 0, column: 1 } };
            },
        };

        const roomControllers = (service as unknown as { roomControllers: Map<string, Map<string, { strategy: unknown; playstyle: Playstyle }>> })
            .roomControllers;
        roomControllers.get('ROOM01')?.set('virtual-1', {
            playstyle: Playstyle.Offensive,
            strategy: oscillatingStrategy,
        });

        service.onGameStateUpdate(oscillatingState);
        jest.runAllTimers();

        expect(gameSessionService.endTurn).toHaveBeenCalledWith('ROOM01', 'virtual-1');
    });

    it('tries an alternative decision when the initial move targets a visited tile', () => {
        const state: GameSessionState = {
            ...sessionState,
            phase: 'turn',
            countdownMode: 'turn',
            activePlayerId: 'virtual-1',
            players: sessionState.players.map((player) =>
                player.id === 'virtual-1'
                    ? {
                          ...player,
                          position: { row: 0, column: 1 },
                          movementPointsLeft: 1,
                          actionsLeft: 1,
                      }
                    : player,
            ),
            cells: [
                { row: 0, column: 0, tile: TileId.Base },
                { row: 0, column: 1, tile: TileId.Base },
                { row: 0, column: 2, tile: TileId.Base },
            ],
        };

        const adaptiveStrategy = {
            getId: () => 'virtual-1',
            process: (gameState: GameSessionState): StrategyDecision => {
                const blocked = gameState.cells.find((cell) => cell.row === 0 && cell.column === 0)?.tile === TileId.Wall;
                return blocked ? { type: 'move', target: { row: 0, column: 2 } } : { type: 'move', target: { row: 0, column: 0 } };
            },
        };

        const roomControllers = (service as unknown as { roomControllers: Map<string, Map<string, { strategy: unknown; playstyle: Playstyle }>> })
            .roomControllers;
        roomControllers.get('ROOM01')?.set('virtual-1', {
            playstyle: Playstyle.Offensive,
            strategy: adaptiveStrategy,
        });

        gameSessionService.getPendingFlagTransfer.mockReturnValue(undefined);
        gameSessionService.getSession.mockImplementation(() => state);
        gameSessionService.movePlayer.mockImplementation((_roomId, playerId, payload) => {
            const player = state.players.find((candidate) => candidate.id === playerId);
            if (!player) {
                return undefined;
            }

            player.position = { row: payload.row, column: payload.column };
            return state;
        });

        const previousTurnStartPositionByPlayer = (service as unknown as { previousTurnStartPositionByPlayer: Map<string, string> })
            .previousTurnStartPositionByPlayer;
        previousTurnStartPositionByPlayer.set('ROOM01|virtual-1', '0,0');

        service.onGameStateUpdate(state);
        jest.runAllTimers();

        expect(gameSessionService.movePlayer).toHaveBeenCalledWith('ROOM01', 'virtual-1', { row: 0, column: 2 });
        expect(gameSessionService.movePlayer).toHaveBeenCalledWith('ROOM01', 'virtual-1', { row: 0, column: 2 });
    });

    it('does not immediately backtrack to previous turn start position on the next turn', () => {
        const state: GameSessionState = {
            ...sessionState,
            phase: 'turn',
            countdownMode: 'turn',
            activePlayerId: 'virtual-1',
            players: sessionState.players.map((player) =>
                player.id === 'virtual-1'
                    ? {
                          ...player,
                          position: { row: 0, column: 1 },
                          movementPointsLeft: 1,
                          actionsLeft: 1,
                      }
                    : player,
            ),
        };

        const alwaysBackAndForthStrategy = {
            getId: () => 'virtual-1',
            process: (gameState: GameSessionState): StrategyDecision => {
                const player = gameState.players.find((candidate) => candidate.id === 'virtual-1');
                if (!player) {
                    return { type: 'none' };
                }

                if (player.position.column === 1) {
                    return { type: 'move', target: { row: 0, column: 2 } };
                }

                return { type: 'move', target: { row: 0, column: 1 } };
            },
        };

        const roomControllers = (service as unknown as { roomControllers: Map<string, Map<string, { strategy: unknown; playstyle: Playstyle }>> })
            .roomControllers;
        roomControllers.get('ROOM01')?.set('virtual-1', {
            playstyle: Playstyle.Offensive,
            strategy: alwaysBackAndForthStrategy,
        });

        gameSessionService.getPendingFlagTransfer.mockReturnValue(undefined);
        gameSessionService.getSession.mockImplementation(() => state);
        gameSessionService.movePlayer.mockImplementation((_roomId, playerId, payload) => {
            const player = state.players.find((candidate) => candidate.id === playerId);
            if (!player) {
                return undefined;
            }

            player.position = { row: payload.row, column: payload.column };
            return state;
        });

        service.onGameStateUpdate(state);
        jest.runAllTimers();

        // Simulate a second turn where the VP starts from the new position.
        service.onGameStateUpdate(state);
        jest.runAllTimers();

        expect(gameSessionService.movePlayer).toHaveBeenCalledTimes(1);
        expect(gameSessionService.endTurn).toHaveBeenCalledWith('ROOM01', 'virtual-1');
    });

    it('waits before acting when returning from combat to turn mode', () => {
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

        const state: GameSessionState = {
            ...sessionState,
            phase: 'turn',
            countdownMode: 'turn',
            activePlayerId: 'virtual-1',
            players: sessionState.players.map((player) =>
                player.id === 'virtual-1'
                    ? {
                          ...player,
                          position: { row: 0, column: 1 },
                          movementPointsLeft: 1,
                          actionsLeft: 1,
                      }
                    : player,
            ),
        };

        const simpleMoveStrategy = {
            getId: () => 'virtual-1',
            process: () => ({ type: 'move', target: { row: 0, column: 2 } }) as StrategyDecision,
        };

        const roomControllers = (service as unknown as { roomControllers: Map<string, Map<string, { strategy: unknown; playstyle: Playstyle }>> })
            .roomControllers;
        roomControllers.get('ROOM01')?.set('virtual-1', {
            playstyle: Playstyle.Offensive,
            strategy: simpleMoveStrategy,
        });

        gameSessionService.getPendingFlagTransfer.mockReturnValue(undefined);
        gameSessionService.getSession.mockImplementation(() => state);
        gameSessionService.movePlayer.mockImplementation((_roomId, playerId, payload) => {
            const player = state.players.find((candidate) => candidate.id === playerId);
            if (!player) {
                return undefined;
            }

            player.position = { row: payload.row, column: payload.column };
            return state;
        });

        service.onGameStateUpdate({ ...state, countdownMode: 'combat' });
        service.onGameStateUpdate(state);
        jest.advanceTimersByTime(800);

        expect(gameSessionService.movePlayer).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1000);
        expect(gameSessionService.movePlayer).toHaveBeenCalled();

        randomSpy.mockRestore();
    });

    it('can move back toward spawn after picking up the flag in the same turn', () => {
        const state: GameSessionState = {
            ...sessionState,
            phase: 'turn',
            countdownMode: 'turn',
            activePlayerId: 'virtual-1',
            players: sessionState.players.map((player) =>
                player.id === 'virtual-1'
                    ? {
                          ...player,
                          hasFlag: false,
                          position: { row: 0, column: 1 },
                          spawnPosition: { row: 0, column: 1 },
                          movementPointsLeft: 2,
                          actionsLeft: 1,
                      }
                    : player,
            ),
        };

        const strategy = {
            getId: () => 'virtual-1',
            process: (gameState: GameSessionState): StrategyDecision => {
                const player = gameState.players.find((candidate) => candidate.id === 'virtual-1');
                if (!player) {
                    return { type: 'none' };
                }

                if (!player.hasFlag) {
                    return { type: 'move', target: { row: 0, column: 2 } };
                }

                if (player.position.column === 2) {
                    return { type: 'move', target: { row: 0, column: 1 } };
                }

                return { type: 'none' };
            },
        };

        const roomControllers = (service as unknown as { roomControllers: Map<string, Map<string, { strategy: unknown; playstyle: Playstyle }>> })
            .roomControllers;
        roomControllers.get('ROOM01')?.set('virtual-1', {
            playstyle: Playstyle.Offensive,
            strategy,
        });

        gameSessionService.getPendingFlagTransfer.mockReturnValue(undefined);
        gameSessionService.getSession.mockImplementation(() => state);
        gameSessionService.movePlayer.mockImplementation((_roomId, playerId, payload) => {
            const player = state.players.find((candidate) => candidate.id === playerId);
            if (!player) {
                return undefined;
            }

            player.position = { row: payload.row, column: payload.column };
            player.movementPointsLeft = Math.max(0, player.movementPointsLeft - 1);
            if (payload.row === 0 && payload.column === 2) {
                player.hasFlag = true;
            }

            return state;
        });

        service.onGameStateUpdate(state);
        jest.runAllTimers();

        expect(gameSessionService.movePlayer).toHaveBeenCalledTimes(2);
        expect(gameSessionService.movePlayer).toHaveBeenNthCalledWith(1, 'ROOM01', 'virtual-1', { row: 0, column: 2 });
        expect(gameSessionService.movePlayer).toHaveBeenNthCalledWith(2, 'ROOM01', 'virtual-1', { row: 0, column: 1 });
    });

    it('can backtrack to an intermediate visited tile after picking up the flag', () => {
        const state: GameSessionState = {
            ...sessionState,
            phase: 'turn',
            countdownMode: 'turn',
            activePlayerId: 'virtual-1',
            players: sessionState.players.map((player) =>
                player.id === 'virtual-1'
                    ? {
                          ...player,
                          hasFlag: false,
                          position: { row: 0, column: 0 },
                          spawnPosition: { row: 0, column: 0 },
                          movementPointsLeft: 4,
                          actionsLeft: 1,
                      }
                    : player,
            ),
            cells: [
                { row: 0, column: 0, tile: TileId.Base },
                { row: 0, column: 1, tile: TileId.Base },
                { row: 0, column: 2, tile: TileId.Base },
                { row: 0, column: 3, tile: TileId.Base, object: ObjectId.Flag },
            ],
        };

        const strategy = {
            getId: () => 'virtual-1',
            process: (gameState: GameSessionState): StrategyDecision => {
                const player = gameState.players.find((candidate) => candidate.id === 'virtual-1');
                if (!player) {
                    return { type: 'none' };
                }

                if (!player.hasFlag) {
                    if (player.position.column === 0) {
                        return { type: 'move', target: { row: 0, column: 1 } };
                    }
                    if (player.position.column === 1) {
                        return { type: 'move', target: { row: 0, column: 2 } };
                    }
                    if (player.position.column === 2) {
                        return { type: 'move', target: { row: 0, column: 3 } };
                    }
                    return { type: 'none' };
                }

                if (player.position.column === 3) {
                    return { type: 'move', target: { row: 0, column: 2 } };
                }

                return { type: 'none' };
            },
        };

        const roomControllers = (service as unknown as { roomControllers: Map<string, Map<string, { strategy: unknown; playstyle: Playstyle }>> })
            .roomControllers;
        roomControllers.get('ROOM01')?.set('virtual-1', {
            playstyle: Playstyle.Offensive,
            strategy,
        });

        gameSessionService.getPendingFlagTransfer.mockReturnValue(undefined);
        gameSessionService.getSession.mockImplementation(() => state);
        gameSessionService.movePlayer.mockImplementation((_roomId, playerId, payload) => {
            const player = state.players.find((candidate) => candidate.id === playerId);
            if (!player) {
                return undefined;
            }

            player.position = { row: payload.row, column: payload.column };
            player.movementPointsLeft = Math.max(0, player.movementPointsLeft - 1);
            if (payload.row === 0 && payload.column === 3) {
                player.hasFlag = true;
            }

            return state;
        });

        service.onGameStateUpdate(state);
        jest.runAllTimers();

        expect(gameSessionService.movePlayer).toHaveBeenNthCalledWith(1, 'ROOM01', 'virtual-1', { row: 0, column: 1 });
        expect(gameSessionService.movePlayer).toHaveBeenNthCalledWith(2, 'ROOM01', 'virtual-1', { row: 0, column: 2 });
        expect(gameSessionService.movePlayer).toHaveBeenNthCalledWith(3, 'ROOM01', 'virtual-1', { row: 0, column: 3 });
        expect(gameSessionService.movePlayer).toHaveBeenNthCalledWith(4, 'ROOM01', 'virtual-1', { row: 0, column: 2 });
    });
});
