import { GameGridCell } from '@app/interfaces/game';
import { DoorState, GridSize, ObjectId, TileId } from '@common/game';
import { GameSessionState } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';
import { GamePageMovementService } from './game-page-movement.service';

/**
 * Strategie :
 * - tester GamePageMovementService sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('GamePageMovementService', () => {
    let service: GamePageMovementService;

    const buildSession = (): GameSessionState => ({
        sessionId: 'ROOM01',
        roomId: 'ROOM01',
        gameId: 'game-1',
        gridSize: GridSize.Small,
        cells: [],
        players: [
            {
                id: 'player-1',
                name: 'Hote',
                avatar: {
                    avatarName: AvatarName.Barbie,
                    imageUrl: 'assets/characters/barbie.png',
                },
                playerType: PlayerType.HumanPlayer,
                maxHealth: 6,
                health: 6,
                speed: 6,
                attack: 4,
                defense: 4,
                attackDice: 'D4',
                defenseDice: 'D6',
                movementPointsLeft: 3,
                combatSanctuaryPointsLeft: 0,
                actionsLeft: 1,
                combatsWon: 0,
                turnOrder: 1,
                isHost: true,
                hasAbandoned: false,
                position: { row: 0, column: 0 },
            },
        ],
        activePlayerId: 'player-1',
        phase: 'turn',
        countdownMode: 'turn',
        countdownCombatPlayerIds: [],
        turnRemainingSeconds: 30,
        debugMode: false,
        messages: [],
    });

    beforeEach(() => {
        service = new GamePageMovementService();
    });

    it('does not expose a closed door as reachable', () => {
        const cells: GameGridCell[] = [
            { row: 0, column: 0, tile: TileId.Base },
            { row: 0, column: 1, tile: TileId.Door, doorState: DoorState.Closed },
            { row: 1, column: 0, tile: TileId.Base },
        ];

        const reachableCells = service.getReachableCells(cells, buildSession(), buildSession().players[0]);

        expect(reachableCells).toEqual([{ row: 1, column: 0, tile: TileId.Base }]);
    });

    it('exposes an open door as reachable', () => {
        const cells: GameGridCell[] = [
            { row: 0, column: 0, tile: TileId.Base },
            { row: 0, column: 1, tile: TileId.Door, doorState: DoorState.Open },
        ];

        const reachableCells = service.getReachableCells(cells, buildSession(), buildSession().players[0]);

        expect(reachableCells).toEqual([{ row: 0, column: 1, tile: TileId.Door, doorState: DoorState.Open }]);
    });

    it('does not expose a sanctuary tile as reachable', () => {
        const cells: GameGridCell[] = [
            { row: 0, column: 0, tile: TileId.Base },
            { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Heal },
        ];

        const reachableCells = service.getReachableCells(cells, buildSession(), buildSession().players[0]);

        expect(reachableCells).toEqual([]);
    });

    it('exposes an adjacent ice tile as reachable even when movement points are zero', () => {
        const session = buildSession();
        session.players[0].movementPointsLeft = 0;
        const cells: GameGridCell[] = [
            { row: 0, column: 0, tile: TileId.Base },
            { row: 0, column: 1, tile: TileId.Ice },
        ];

        const reachableCells = service.getReachableCells(cells, session, session.players[0]);

        expect(reachableCells).toEqual([{ row: 0, column: 1, tile: TileId.Ice }]);
    });
});
