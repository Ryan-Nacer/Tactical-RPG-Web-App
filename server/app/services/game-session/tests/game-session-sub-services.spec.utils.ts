import { GridSize, ObjectId, TileId } from '@common/game';
import { GameSessionMessage, GameSessionPlayer, GameSessionState } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';

const DEFAULT_TEST_CELLS: GameSessionState['cells'] = [
    { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
    { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Start },
    { row: 1, column: 0, tile: TileId.Base },
    { row: 1, column: 1, tile: TileId.Base },
];

export const createTestPlayer = (id: string, overrides: Partial<GameSessionPlayer> = {}): GameSessionPlayer => ({
    id,
    name: `Joueur ${id}`,
    avatar: { avatarName: AvatarName.Barbie, imageUrl: 'assets/characters/barbie.png' },
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
    combatsTotal: 0,
    turnOrder: Number(id.split('-').at(-1) ?? 1),
    isHost: id === 'player-1',
    hasAbandoned: false,
    hasFlag: false,
    hasHeldFlag: false,
    position: { row: 0, column: 0 },
    ...overrides,
});

export const createTestSession = (
    players: GameSessionPlayer[],
    overrides: Partial<GameSessionState> = {},
    cells: GameSessionState['cells'] = DEFAULT_TEST_CELLS,
): GameSessionState => ({
    sessionId: 'ROOM01',
    roomId: 'ROOM01',
    gameId: 'GAME01',
    gridSize: GridSize.Small,
    cells: cells.map((cell) => ({ ...cell })),
    players,
    activePlayerId: players[0]?.id ?? '',
    phase: 'turn',
    countdownMode: 'turn',
    countdownCombatPlayerIds: [],
    turnRemainingSeconds: 30,
    debugMode: false,
    messages: [],
    ...overrides,
});

export const createAppendMessageMock = () =>
    jest.fn((session: GameSessionState, message: GameSessionMessage) => {
        session.messages.push(message);
    });