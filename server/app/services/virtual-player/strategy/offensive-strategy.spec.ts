import { DoorState, GameCell, GridSize, ObjectId, TileId } from '@common/game';
import { GameSessionPlayer, GameSessionState, GridPosition } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';
import { OffensiveStrategy } from './offensive-strategy';

const DEFAULT_AVATAR = { avatarName: AvatarName.Barbie, imageUrl: 'assets/characters/barbie.png' };

function createBaseCells(): GameCell[] {
    const cells: GameCell[] = [];
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) {
            cells.push({ row, column, tile: TileId.Base });
        }
    }
    return cells;
}

function createCells(rowCount: number, columnCount: number): GameCell[] {
    const cells: GameCell[] = [];
    for (let row = 0; row < rowCount; row++) {
        for (let column = 0; column < columnCount; column++) {
            cells.push({ row, column, tile: TileId.Base });
        }
    }
    return cells;
}

function createPlayer(overrides: Partial<GameSessionPlayer>): GameSessionPlayer {
    return {
        id: 'player-id',
        name: 'Player',
        avatar: DEFAULT_AVATAR,
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
        isHost: false,
        hasAbandoned: false,
        position: { row: 1, column: 1 },
        ...overrides,
    };
}

function createState(players: GameSessionPlayer[], cells: GameCell[]): GameSessionState {
    return {
        sessionId: 'session-id',
        roomId: 'room-id',
        gameId: 'game-id',
        gridSize: GridSize.Small,
        cells,
        players,
        activePlayerId: players[0].id,
        phase: 'turn',
        countdownMode: 'turn',
        countdownCombatPlayerIds: [],
        turnRemainingSeconds: 30,
        debugMode: false,
        messages: [],
    };
}

describe('OffensiveStrategy (CTF flag carrier)', () => {
    it('does not move away when already on spawn while carrying the flag', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const spawnPosition: GridPosition = { row: 1, column: 1 };
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            hasFlag: true,
            team: 'A',
            position: spawnPosition,
            spawnPosition,
            movementPointsLeft: 3,
            actionsLeft: 1,
        });
        const enemy = createPlayer({
            id: 'enemy-1',
            name: 'Enemy',
            team: 'B',
            position: { row: 1, column: 2 },
        });

        const decision = strategy.process(createState([controlledPlayer, enemy], createBaseCells()));

        expect(decision).toEqual({ type: 'none' });
    });

    it('does not attack an adjacent enemy while carrying the flag when it cannot move', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            hasFlag: true,
            team: 'A',
            position: { row: 1, column: 1 },
            spawnPosition: { row: 0, column: 0 },
            movementPointsLeft: 0,
            actionsLeft: 1,
        });
        const enemy = createPlayer({
            id: 'enemy-1',
            name: 'Enemy',
            team: 'B',
            position: { row: 1, column: 2 },
        });

        const decision = strategy.process(createState([controlledPlayer, enemy], createBaseCells()));

        expect(decision).toEqual({ type: 'none' });
    });

    it('prioritizes moving to spawn while carrying the flag even if an enemy is adjacent', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const spawnPosition: GridPosition = { row: 1, column: 0 };
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            hasFlag: true,
            team: 'A',
            position: { row: 1, column: 1 },
            spawnPosition,
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const enemy = createPlayer({
            id: 'enemy-1',
            name: 'Enemy',
            team: 'B',
            position: { row: 1, column: 2 },
        });

        const decision = strategy.process(createState([controlledPlayer, enemy], createBaseCells()));

        expect(decision).toEqual({ type: 'move', target: spawnPosition });
    });

    it('opens an adjacent closed door when carrying the flag and no movement step is available', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            hasFlag: true,
            team: 'A',
            position: { row: 1, column: 1 },
            spawnPosition: { row: 1, column: 3 },
            movementPointsLeft: 0,
            actionsLeft: 1,
        });
        const enemy = createPlayer({
            id: 'enemy-1',
            name: 'Enemy',
            team: 'B',
            position: { row: 0, column: 0 },
        });
        const cells = createBaseCells().map((cell) =>
            cell.row === 1 && cell.column === 2 ? { ...cell, tile: TileId.Door, doorState: DoorState.Closed } : cell,
        );

        const decision = strategy.process(createState([controlledPlayer, enemy], cells));

        expect(decision).toEqual({ type: 'action', target: { row: 1, column: 2 } });
    });

    it('attacks an adjacent enemy occupying its spawn while carrying the flag', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const spawnPosition: GridPosition = { row: 1, column: 1 };
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            hasFlag: true,
            team: 'A',
            position: { row: 1, column: 2 },
            spawnPosition,
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const enemyOnSpawn = createPlayer({
            id: 'enemy-on-spawn',
            name: 'Enemy On Spawn',
            team: 'B',
            position: spawnPosition,
        });
        const cells = createCells(4, 4);

        const decision = strategy.process(createState([controlledPlayer, enemyOnSpawn], cells));

        expect(decision).toEqual({ type: 'action', target: spawnPosition });
    });

    it('keeps moving toward spawn when carrying the flag and spawn tile is occupied', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const spawnPosition: GridPosition = { row: 1, column: 1 };
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            hasFlag: true,
            team: 'A',
            position: { row: 2, column: 2 },
            spawnPosition,
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const spawnOccupant = createPlayer({
            id: 'enemy-on-spawn',
            name: 'Enemy On Spawn',
            team: 'B',
            position: spawnPosition,
        });
        const cells = createCells(4, 4);

        const decision = strategy.process(createState([controlledPlayer, spawnOccupant], cells));

        expect(decision.type).toBe('move');
        if (decision.type !== 'move') {
            throw new Error('Expected move decision');
        }

        const beforeDistance =
            Math.abs(controlledPlayer.position.row - spawnPosition.row) + Math.abs(controlledPlayer.position.column - spawnPosition.column);
        const afterDistance = Math.abs(decision.target.row - spawnPosition.row) + Math.abs(decision.target.column - spawnPosition.column);
        expect(afterDistance).toBeLessThan(beforeDistance);
    });

    it('opens a closed door when it is a shorter CTF path than the detour while carrying the flag', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            hasFlag: true,
            team: 'A',
            position: { row: 3, column: 3 },
            spawnPosition: { row: 0, column: 3 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const cells = createCells(6, 7).map((cell) => {
            if (cell.row === 2 && cell.column === 3) {
                return { ...cell, tile: TileId.Door, doorState: DoorState.Closed };
            }

            if (cell.row === 2 && cell.column !== 0) {
                return { ...cell, tile: TileId.Wall };
            }

            return cell;
        });

        const decision = strategy.process(createState([controlledPlayer], cells));

        expect(decision).toEqual({ type: 'action', target: { row: 2, column: 3 } });
    });
});

describe('OffensiveStrategy (CTF door shortcut)', () => {
    it('moves toward the door interaction tile when opening that door is the shortest path to the flag', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            position: { row: 4, column: 3 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const cells = createCells(6, 7).map((cell) => {
            if (cell.row === 2 && cell.column === 3) {
                return { ...cell, tile: TileId.Door, doorState: DoorState.Closed };
            }

            if (cell.row === 2 && cell.column !== 0) {
                return { ...cell, tile: TileId.Wall };
            }

            if (cell.row === 0 && cell.column === 3) {
                return { ...cell, object: ObjectId.Flag };
            }

            return cell;
        });

        const decision = strategy.process(createState([controlledPlayer], cells));

        expect(decision).toEqual({ type: 'move', target: { row: 3, column: 3 } });
    });

    it('opens the door when door path ties with a detour path to the flag', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            position: { row: 2, column: 1 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const cells = createCells(3, 3).map((cell) => {
            if (cell.row === 1 && cell.column === 1) {
                return { ...cell, tile: TileId.Door, doorState: DoorState.Closed };
            }

            if (cell.row === 2 && cell.column === 0) {
                return { ...cell, tile: TileId.Ice };
            }

            if (cell.row === 0 && cell.column === 1) {
                return { ...cell, object: ObjectId.Flag };
            }

            return cell;
        });

        const decision = strategy.process(createState([controlledPlayer], cells));

        expect(decision).toEqual({ type: 'action', target: { row: 1, column: 1 } });
    });

    it('still prioritizes opening the useful door in CTF even when an icy detour is cheaper', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            position: { row: 3, column: 3 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const cells = createCells(5, 7).map((cell) => {
            if (cell.row === 2 && cell.column === 3) {
                return { ...cell, tile: TileId.Door, doorState: DoorState.Closed };
            }

            if (cell.row === 2 && cell.column !== 0 && cell.column !== 6 && cell.column !== 3) {
                return { ...cell, tile: TileId.Wall };
            }

            if (cell.row === 1 && cell.column === 3) {
                return { ...cell, object: ObjectId.Flag };
            }

            // Icy corridor for the detour (very cheap), but CTF should still prefer the useful door.
            if (
                (cell.row === 3 && cell.column >= 3 && cell.column <= 6) ||
                (cell.row === 2 && cell.column === 6) ||
                (cell.row === 1 && cell.column >= 3 && cell.column <= 6)
            ) {
                return { ...cell, tile: TileId.Ice };
            }

            return cell;
        });

        const decision = strategy.process(createState([controlledPlayer], cells));

        expect(decision).toEqual({ type: 'action', target: { row: 2, column: 3 } });
    });
});

describe('OffensiveStrategy (CTF priority on complex maps)', () => {
    it('keeps flag priority instead of attacking a nearby non-flag enemy when flag path is complex', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            position: { row: 6, column: 3 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const nearbyEnemy = createPlayer({
            id: 'enemy-1',
            name: 'Nearby Enemy',
            team: 'B',
            position: { row: 6, column: 4 },
            hasFlag: false,
        });

        const cells = createCells(7, 7).map((cell) => {
            if (cell.row === 0 && cell.column === 3) {
                return { ...cell, object: ObjectId.Flag };
            }

            if (cell.row === 4) {
                if (cell.column === 3) {
                    return { ...cell, tile: TileId.Door, doorState: DoorState.Closed };
                }
                return { ...cell, tile: TileId.Wall };
            }

            if (cell.row === 2) {
                if (cell.column === 3) {
                    return { ...cell, tile: TileId.Door, doorState: DoorState.Closed };
                }
                return { ...cell, tile: TileId.Wall };
            }

            return cell;
        });

        const decision = strategy.process(createState([controlledPlayer, nearbyEnemy], cells));

        expect(decision).toEqual({ type: 'move', target: { row: 5, column: 3 } });
    });

    it('switches to classic aggressive behavior when an ally carries the flag', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            hasFlag: false,
            position: { row: 3, column: 3 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const allyFlagBearer = createPlayer({
            id: 'ally-flag',
            name: 'Ally Flag',
            team: 'A',
            hasFlag: true,
            position: { row: 0, column: 0 },
        });
        const nearbyEnemy = createPlayer({
            id: 'enemy-1',
            name: 'Nearby Enemy',
            team: 'B',
            position: { row: 3, column: 4 },
            hasFlag: false,
        });
        const cells = createCells(7, 7);

        const decision = strategy.process(createState([controlledPlayer, allyFlagBearer, nearbyEnemy], cells));

        expect(decision).toEqual({ type: 'action', target: nearbyEnemy.position });
    });
});

describe('OffensiveStrategy (heal sanctuary usage)', () => {
    it('uses heal sanctuary only when health is critical', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            health: 2,
            maxHealth: 6,
            position: { row: 1, column: 1 },
            movementPointsLeft: 0,
            actionsLeft: 1,
        });
        const cells = createBaseCells().map((cell) => (cell.row === 1 && cell.column === 2 ? { ...cell, object: ObjectId.Heal } : cell));

        const decision = strategy.process(createState([controlledPlayer], cells));

        expect(decision).toEqual({ type: 'action', target: { row: 1, column: 2 }, sanctuaryMode: 'normal' });
    });

    it('does not use heal sanctuary when only slightly wounded', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            health: 5,
            maxHealth: 6,
            position: { row: 1, column: 1 },
            movementPointsLeft: 0,
            actionsLeft: 1,
        });
        const cells = createBaseCells().map((cell) => (cell.row === 1 && cell.column === 2 ? { ...cell, object: ObjectId.Heal } : cell));

        const decision = strategy.process(createState([controlledPlayer], cells));

        expect(decision).toEqual({ type: 'none' });
    });
});

describe('OffensiveStrategy (door pursuit)', () => {
    it('opens an adjacent closed door when it shortens pursuit path to an enemy behind walls', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            position: { row: 3, column: 3 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const enemy = createPlayer({
            id: 'enemy-1',
            name: 'Enemy',
            position: { row: 0, column: 3 },
        });
        const cells = createCells(6, 7).map((cell) => {
            if (cell.row === 2 && cell.column === 3) {
                return { ...cell, tile: TileId.Door, doorState: DoorState.Closed };
            }

            if (cell.row === 2 && cell.column !== 0) {
                return { ...cell, tile: TileId.Wall };
            }

            return cell;
        });

        const decision = strategy.process(createState([controlledPlayer, enemy], cells));

        expect(decision).toEqual({ type: 'action', target: { row: 2, column: 3 } });
    });

    it('opens an adjacent closed door before trying to move toward door goals', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            position: { row: 3, column: 2 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const enemy = createPlayer({
            id: 'enemy-1',
            name: 'Enemy',
            position: { row: 1, column: 2 },
        });
        const cells = createCells(5, 5).map((cell) => {
            if (cell.row === 2) {
                if (cell.column === 2) {
                    return { ...cell, tile: TileId.Door, doorState: DoorState.Closed };
                }
                return { ...cell, tile: TileId.Wall };
            }
            return cell;
        });

        const decision = strategy.process(createState([controlledPlayer, enemy], cells));

        expect(decision).toEqual({ type: 'action', target: { row: 2, column: 2 } });
    });

    it('moves toward a closed door when the closest enemy is unreachable behind it', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            position: { row: 4, column: 2 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const enemy = createPlayer({
            id: 'enemy-1',
            name: 'Enemy',
            position: { row: 0, column: 2 },
        });

        const cells = createCells(5, 5).map((cell) => {
            if (cell.row === 2) {
                if (cell.column === 2) {
                    return { ...cell, tile: TileId.Door, doorState: DoorState.Closed };
                }
                return { ...cell, tile: TileId.Wall };
            }
            return cell;
        });

        const decision = strategy.process(createState([controlledPlayer, enemy], cells));

        expect(decision).toEqual({ type: 'move', target: { row: 3, column: 2 } });
    });
});

describe('OffensiveStrategy (ice movement with zero MP)', () => {
    it('can still move on ice when movement points are zero', () => {
        const strategy = new OffensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            position: { row: 1, column: 1 },
            movementPointsLeft: 0,
            actionsLeft: 1,
        });
        const enemy = createPlayer({
            id: 'enemy-1',
            name: 'Enemy',
            position: { row: 1, column: 4 },
        });
        const cells = createCells(3, 5).map((cell) => {
            if (cell.row === 1 && cell.column >= 1 && cell.column <= 4) {
                return { ...cell, tile: TileId.Ice };
            }

            if (cell.row === 1 && cell.column === 0) {
                return { ...cell, tile: TileId.Wall };
            }

            return { ...cell, tile: TileId.Wall };
        });

        const decision = strategy.process(createState([controlledPlayer, enemy], cells));

        expect(decision).toEqual({ type: 'move', target: { row: 1, column: 2 } });
    });
});
