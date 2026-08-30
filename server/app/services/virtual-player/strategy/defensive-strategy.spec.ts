import { DoorState, GameCell, GridSize, ObjectId, TileId } from '@common/game';
import { GameSessionPlayer, GameSessionState, GridPosition } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';
import { DefensiveStrategy } from './defensive-strategy';

const DEFAULT_AVATAR = { avatarName: AvatarName.Barbie, imageUrl: 'assets/characters/barbie.png' };

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
        hasFlag: false,
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

describe('DefensiveStrategy (sanctuary usage)', () => {
    it('uses heal sanctuary when health is critical', () => {
        const strategy = new DefensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            health: 2,
            maxHealth: 6,
            position: { row: 1, column: 1 },
            movementPointsLeft: 0,
            actionsLeft: 1,
        });
        const cells = createCells(3, 3).map((cell) =>
            cell.row === 1 && cell.column === 2 ? { ...cell, object: ObjectId.Heal, shrineId: 'heal-1', shrineCooldownTurns: 0 } : cell,
        );

        const decision = strategy.process(createState([controlledPlayer], cells));

        expect(decision).toEqual({ type: 'action', target: { row: 1, column: 2 }, sanctuaryMode: 'normal' });
    });

    it('does not use heal sanctuary when only slightly wounded', () => {
        const strategy = new DefensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            health: 5,
            maxHealth: 6,
            position: { row: 1, column: 1 },
            movementPointsLeft: 0,
            actionsLeft: 1,
        });
        const cells = createCells(3, 3).map((cell) =>
            cell.row === 1 && cell.column === 2 ? { ...cell, object: ObjectId.Heal, shrineId: 'heal-1', shrineCooldownTurns: 0 } : cell,
        );

        const decision = strategy.process(createState([controlledPlayer], cells));

        expect(decision).toEqual({ type: 'none' });
    });

    it('does not use combat sanctuary when no threat is nearby', () => {
        const strategy = new DefensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            position: { row: 1, column: 1 },
            movementPointsLeft: 0,
            actionsLeft: 1,
        });
        const cells = createCells(3, 3).map((cell) =>
            cell.row === 1 && cell.column === 2 ? { ...cell, object: ObjectId.Combat, shrineId: 'combat-1', shrineCooldownTurns: 0 } : cell,
        );

        const decision = strategy.process(createState([controlledPlayer], cells));

        expect(decision).toEqual({ type: 'none' });
    });

    it('uses combat sanctuary when a nearby threat exists and retreat is blocked', () => {
        const strategy = new DefensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            position: { row: 1, column: 1 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const enemy = createPlayer({
            id: 'enemy-1',
            name: 'Enemy',
            position: { row: 1, column: 0 },
            team: 'B',
        });
        const cells = createCells(3, 3).map((cell) => {
            if (cell.row === 0 && cell.column === 1) {
                return { ...cell, tile: TileId.Wall };
            }
            if (cell.row === 2 && cell.column === 1) {
                return { ...cell, tile: TileId.Wall };
            }
            if (cell.row === 1 && cell.column === 2) {
                return { ...cell, object: ObjectId.Combat, shrineId: 'combat-1', shrineCooldownTurns: 0 };
            }
            return cell;
        });

        const decision = strategy.process(createState([controlledPlayer, enemy], cells));

        expect(decision).toEqual({ type: 'action', target: { row: 1, column: 2 }, sanctuaryMode: 'normal' });
    });
});

describe('DefensiveStrategy (ctf survival guard)', () => {
    it('does not heal while carrying the flag, and keeps CTF objective priority', () => {
        const strategy = new DefensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            hasFlag: true,
            health: 1,
            maxHealth: 6,
            position: { row: 1, column: 1 },
            spawnPosition: { row: 1, column: 0 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const cells = createCells(3, 3).map((cell) =>
            cell.row === 1 && cell.column === 2 ? { ...cell, object: ObjectId.Heal, shrineId: 'heal-1', shrineCooldownTurns: 0 } : cell,
        );

        const decision = strategy.process(createState([controlledPlayer], cells));

        expect(decision).toEqual({ type: 'move', target: { row: 1, column: 0 } });
    });

    it('opens a closed door on the shortest CTF return path while carrying the flag', () => {
        const strategy = new DefensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            hasFlag: true,
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

    it('attacks an adjacent enemy occupying its spawn while carrying the flag', () => {
        const strategy = new DefensiveStrategy('vp-1');
        const spawnPosition: GridPosition = { row: 1, column: 1 };
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            hasFlag: true,
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
        const strategy = new DefensiveStrategy('vp-1');
        const spawnPosition: GridPosition = { row: 1, column: 1 };
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            hasFlag: true,
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

    it('does not directly attack an adjacent enemy flag bearer, and moves to intercept spawn instead', () => {
        const strategy = new DefensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            position: { row: 2, column: 2 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const enemyFlagBearer = createPlayer({
            id: 'enemy-flag',
            name: 'Enemy Flag',
            team: 'B',
            hasFlag: true,
            position: { row: 2, column: 3 },
            spawnPosition: { row: 0, column: 0 },
        });
        const cells = createCells(5, 5);

        const decision = strategy.process(createState([controlledPlayer, enemyFlagBearer], cells));

        expect(decision.type).toBe('move');
        if (decision.type === 'move') {
            expect(decision.target).not.toEqual(enemyFlagBearer.position);
        }
    });

    it('moves closer to enemy spawn when enemy carries the flag', () => {
        const strategy = new DefensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            position: { row: 4, column: 4 },
            movementPointsLeft: 1,
            actionsLeft: 1,
        });
        const enemyFlagBearer = createPlayer({
            id: 'enemy-flag',
            name: 'Enemy Flag',
            team: 'B',
            hasFlag: true,
            position: { row: 4, column: 5 },
            spawnPosition: { row: 8, column: 1 },
        });
        const cells = createCells(10, 10);

        const decision = strategy.process(createState([controlledPlayer, enemyFlagBearer], cells));

        expect(decision.type).toBe('move');
        if (decision.type === 'move') {
            const currentDistance =
                Math.abs(controlledPlayer.position.row - enemyFlagBearer.spawnPosition!.row) +
                Math.abs(controlledPlayer.position.column - enemyFlagBearer.spawnPosition!.column);
            const nextDistance =
                Math.abs(decision.target.row - enemyFlagBearer.spawnPosition!.row) +
                Math.abs(decision.target.column - enemyFlagBearer.spawnPosition!.column);
            expect(nextDistance).toBeLessThan(currentDistance);
        }
    });

    it('holds position when already on enemy spawn while intercepting flag carrier', () => {
        const strategy = new DefensiveStrategy('vp-1');
        const controlledPlayer = createPlayer({
            id: 'vp-1',
            playerType: PlayerType.VirtualPlayer,
            team: 'A',
            position: { row: 7, column: 1 },
            movementPointsLeft: 3,
            actionsLeft: 1,
        });
        const enemyFlagBearer = createPlayer({
            id: 'enemy-flag',
            name: 'Enemy Flag',
            team: 'B',
            hasFlag: true,
            position: { row: 7, column: 2 },
            spawnPosition: { row: 7, column: 1 },
        });
        const cells = createCells(10, 10);

        const decision = strategy.process(createState([controlledPlayer, enemyFlagBearer], cells));

        expect(decision).toEqual({ type: 'none' });
    });
});
