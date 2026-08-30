import { DoorState, GameCell, GridSize, ObjectId, TileId, getTerrainMovementCost } from '@common/game';
import { GameSessionPlayer, GameSessionState } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';
import { RoomState } from '@common/wait-room';
import { PlayerService } from './player.service';

const ACTIONS_PER_TURN = 1;
const SANCTUARY_TURNS_LEFT = 5;

/**
 * Strategie :
 * - tester PlayerService comme logique fine appliquee a chaque joueur dans une session
 * - verifier le placement initial, les deplacements, les calculs de cout et les actions
 *   qui changent les statistiques du joueur actif
 *
 * Cas limites cibles :
 * - cellules de depart insuffisantes ou bloquees
 * - couts de terrain et destinations invalides
 * - etats de joueur limites comme les points ou actions epuises
 */
describe('PlayerService', () => {
    let service: PlayerService;

    const roomState: RoomState = {
        roomId: 'ROOM01',
        hostId: 'player-1',
        gameId: 'game-1',
        gameName: 'Test Game',
        maxPlayers: 2,
        isLocked: true,
        mode: 'CLASSIC',
        players: [
            {
                id: 'player-1',
                name: 'Joueur 1',
                avatar: { avatarName: AvatarName.Barbie, imageUrl: 'assets/characters/barbie.png' },
                playerType: PlayerType.HumanPlayer,
                character: {
                    health: 6,
                    maxHealth: 6,
                    speed: 6,
                    attack: 4,
                    defense: 4,
                    attackDice: 'D4',
                    defenseDice: 'D6',
                    movementPointsLeft: 6,
                    combatSanctuaryPointsLeft: 0,
                    actionsLeft: ACTIONS_PER_TURN,
                },
            },
            {
                id: 'player-2',
                name: 'Joueur 2',
                avatar: { avatarName: AvatarName.Raquelle, imageUrl: 'assets/characters/raquelle.png' },
                playerType: PlayerType.HumanPlayer,
                character: {
                    health: 8,
                    maxHealth: 8,
                    speed: 4,
                    attack: 6,
                    defense: 4,
                    attackDice: 'D6',
                    defenseDice: 'D4',
                    movementPointsLeft: 4,
                    combatSanctuaryPointsLeft: 0,
                    actionsLeft: ACTIONS_PER_TURN,
                },
            },
        ],
    };

    const startCells: GameCell[] = [
        { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
        { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Start },
    ];

    function buildSession(cells: GameCell[], players: GameSessionPlayer[]): GameSessionState {
        return {
            sessionId: 'ROOM01',
            roomId: 'ROOM01',
            gameId: 'game-1',
            gridSize: GridSize.Small,
            cells,
            players,
            activePlayerId: players[0]?.id ?? '',
            phase: 'turn',
            countdownMode: 'turn',
            countdownCombatPlayerIds: [],
            turnRemainingSeconds: 30,
            debugMode: false,
            messages: [],
            //
            startTime: 0,
            endTime: 0,
        };
    }

    beforeEach(() => {
        service = new PlayerService();
    });

    describe('createSessionPlayers', () => {
        it('creates players with positions assigned from start cells', () => {
            const players = service.createSessionPlayers(roomState, startCells);

            expect(players).toHaveLength(2);
            expect(players[0].id).toBe('player-1');
            expect(players[0].position).toEqual({ row: 0, column: 0 });
            expect(players[0].isHost).toBe(true);
            expect(players[1].id).toBe('player-2');
            expect(players[1].position).toEqual({ row: 0, column: 1 });
            expect(players[1].isHost).toBe(false);
        });

        it('throws when there are not enough start cells for all players', () => {
            expect(() => service.createSessionPlayers(roomState, [startCells[0]])).toThrow(
                'Nombre insuffisant de points de depart pour initialiser tous les joueurs.',
            );
        });
    });

    describe('tryMoveActivePlayer', () => {
        it('moves the player and deducts the base tile movement cost', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Base }, { row: 1, column: 1, tile: TileId.Wall }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);
            const player1Speed = players[0].speed;

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(true);
            expect(session.players[0].position).toEqual({ row: 1, column: 0 });
            expect(session.players[0].movementPointsLeft).toBe(player1Speed - getTerrainMovementCost(TileId.Base));
        });

        it('deducts 2 movement points when moving onto a water tile', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Water }, { row: 1, column: 1, tile: TileId.Wall }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);
            const player1Speed = players[0].speed;

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(true);
            expect(session.players[0].movementPointsLeft).toBe(player1Speed - getTerrainMovementCost(TileId.Water));
        });

        it('deducts 0 movement points when moving onto an ice tile', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Ice }, { row: 1, column: 1, tile: TileId.Wall }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);
            const player1Speed = players[0].speed;

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(true);
            expect(session.players[0].movementPointsLeft).toBe(player1Speed - getTerrainMovementCost(TileId.Ice));
        });

        it('allows moving onto an ice tile even when no movement points remain', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Ice }, { row: 1, column: 1, tile: TileId.Wall }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);
            session.players[0].movementPointsLeft = 0;

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(true);
            expect(session.players[0].position).toEqual({ row: 1, column: 0 });
            expect(session.players[0].movementPointsLeft).toBe(0);
        });

        it('allows movement through an open door at the standard movement cost', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Door, doorState: DoorState.Open }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);
            const player1Speed = players[0].speed;

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(true);
            expect(session.players[0].position).toEqual({ row: 1, column: 0 });
            expect(session.players[0].movementPointsLeft).toBe(player1Speed - getTerrainMovementCost(TileId.Door));
        });

        it('refuses movement through a closed door', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Door, doorState: DoorState.Closed }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(false);
            expect(session.players[0].position).toEqual({ row: 0, column: 0 });
        });

        it('refuses movement onto a sanctuary tile', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Base, object: ObjectId.Heal }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(false);
            expect(session.players[0].position).toEqual({ row: 0, column: 0 });
        });

        it('refuses the move when movement points are insufficient for the destination tile', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Water }, { row: 1, column: 1, tile: TileId.Wall }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);
            const waterCost = getTerrainMovementCost(TileId.Water);
            session.players[0].movementPointsLeft = waterCost - 1;

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(false);
            expect(session.players[0].position).toEqual({ row: 0, column: 0 });
        });

        it('refuses the move when the destination cell is occupied by another player', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Base }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 0, column: 1 });

            expect(result).toBe(false);
            expect(session.players[0].position).toEqual({ row: 0, column: 0 });
        });

        it('refuses the move when the destination cell is a wall', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Base }, { row: 1, column: 1, tile: TileId.Wall }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 1, column: 1 });

            expect(result).toBe(false);
        });

        it('refuses the move when the game phase is not "turn"', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Base }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);
            session.phase = 'transition';

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(false);
        });

        it('refuses the move when the destination cell is not adjacent', () => {
            const cells: GameCell[] = [...startCells, { row: 2, column: 0, tile: TileId.Base }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);

            const result = service.tryMoveActivePlayer(session, 'player-1', { row: 2, column: 0 });

            expect(result).toBe(false);
        });
    });

    describe('tryTeleportActivePlayer', () => {
        it('teleports the active player to a free terrain tile without consuming movement', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Base }, { row: 1, column: 1, tile: TileId.Water }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);
            const initialMovement = players[0].movementPointsLeft;

            const result = service.tryTeleportActivePlayer(session, 'player-1', { row: 1, column: 1 });

            expect(result).toBe(true);
            expect(session.players[0].position).toEqual({ row: 1, column: 1 });
            expect(session.players[0].movementPointsLeft).toBe(initialMovement);
        });

        it('refuses teleportation to a tile containing an object', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Base, object: ObjectId.Heal }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);

            const result = service.tryTeleportActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(false);
            expect(session.players[0].position).toEqual({ row: 0, column: 0 });
        });

        it('refuses teleportation to an occupied tile', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Base }];
            const players = service.createSessionPlayers(roomState, startCells);
            players[1].position = { row: 1, column: 0 };
            const session = buildSession(cells, players);

            const result = service.tryTeleportActivePlayer(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBe(false);
            expect(session.players[0].position).toEqual({ row: 0, column: 0 });
        });
    });

    describe('tryPerformCombatAction', () => {
        it('returns the adjacent target player when an opponent occupies an adjacent tile', () => {
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(startCells, players);

            const result = service.tryPerformCombatAction(session, 'player-1', { row: 0, column: 1 });

            expect(result).not.toBeNull();
            expect(result?.id).toBe('player-2');
        });

        it('returns null when the target tile is not adjacent', () => {
            const cells: GameCell[] = [...startCells, { row: 2, column: 2, tile: TileId.Base }];
            const players = service.createSessionPlayers(roomState, startCells);
            players[1].position = { row: 2, column: 2 };
            const session = buildSession(cells, players);

            const result = service.tryPerformCombatAction(session, 'player-1', { row: 2, column: 2 });

            expect(result).toBeNull();
        });

        it('returns null when the target tile contains no opponent', () => {
            const cells: GameCell[] = [...startCells, { row: 1, column: 0, tile: TileId.Base }];
            const players = service.createSessionPlayers(roomState, startCells);
            const session = buildSession(cells, players);

            const result = service.tryPerformCombatAction(session, 'player-1', { row: 1, column: 0 });

            expect(result).toBeNull();
        });
    });

    describe('resetTurnResources', () => {
        it('resets movement points, actions and combat sanctuary points', () => {
            const players = service.createSessionPlayers(roomState, startCells);
            const player = players[0];
            player.movementPointsLeft = 2;
            player.actionsLeft = 0;
            player.combatSanctuaryPointsLeft = SANCTUARY_TURNS_LEFT;

            service.resetTurnResources(player, ACTIONS_PER_TURN);

            expect(player.movementPointsLeft).toBe(player.speed);
            expect(player.actionsLeft).toBe(ACTIONS_PER_TURN);
            expect(player.combatSanctuaryPointsLeft).toBe(SANCTUARY_TURNS_LEFT);
        });
    });
});
