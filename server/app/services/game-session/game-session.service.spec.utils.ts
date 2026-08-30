import { Games } from '@app/model/database/game';
import { GridSize, Mode, ObjectId, TileId } from '@common/game';
import { AvatarName, PlayerType } from '@common/player';
import { RoomState } from '@common/wait-room';

export const ONE_SECOND_MS = 1000;
export const EXTRA_TICK = 1;

export const roomState: RoomState = {
    roomId: 'ROOM01',
    hostId: 'player-1',
    gameId: 'game-1',
    gameName: 'Jeu de test',
    maxPlayers: 2,
    isLocked: true,
    mode: 'CLASSIC',
    players: [
        {
            id: 'player-1',
            name: 'Joueur 1',
            avatar: {
                avatarName: AvatarName.Barbie,
                imageUrl: 'assets/characters/barbie.png',
            },
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
                actionsLeft: 1,
            },
        },
        {
            id: 'player-2',
            name: 'Joueur 2',
            avatar: {
                avatarName: AvatarName.Raquelle,
                imageUrl: 'assets/characters/raquelle.png',
            },
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
                actionsLeft: 1,
            },
        },
    ],
};

export const game: Games = {
    id: 'game-1',
    name: 'Jeu test',
    mode: Mode.Classic,
    size: GridSize.Small,
    description: 'Description',
    isVisible: true,
    cells: [
        { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
        { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Start },
        { row: 1, column: 0, tile: TileId.Base },
        { row: 1, column: 1, tile: TileId.Wall },
    ],
};

export const ctfGame: Games = {
    ...game,
    mode: Mode.CTF,
};

export const fourPlayerRoomState: RoomState = {
    ...roomState,
    maxPlayers: 4,
    players: [
        ...roomState.players,
        {
            id: 'player-3',
            name: 'Joueur 3',
            avatar: { avatarName: AvatarName.Teresa, imageUrl: 'assets/characters/teresa.png' },
            playerType: PlayerType.HumanPlayer,
            character: {
                health: 6,
                maxHealth: 6,
                speed: 3,
                attack: 4,
                defense: 4,
                attackDice: 'D4' as const,
                defenseDice: 'D6' as const,
                movementPointsLeft: 3,
                combatSanctuaryPointsLeft: 0,
                actionsLeft: 1,
            },
        },
        {
            id: 'player-4',
            name: 'Joueur 4',
            avatar: { avatarName: AvatarName.Ken, imageUrl: 'assets/characters/ken.png' },
            playerType: PlayerType.HumanPlayer,
            character: {
                health: 6,
                maxHealth: 6,
                speed: 2,
                attack: 4,
                defense: 4,
                attackDice: 'D4' as const,
                defenseDice: 'D6' as const,
                movementPointsLeft: 2,
                combatSanctuaryPointsLeft: 0,
                actionsLeft: 1,
            },
        },
    ],
};

export const fourPlayerCtfGame: Games = {
    ...ctfGame,
    cells: [
        { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
        { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Start },
        { row: 1, column: 0, tile: TileId.Base, object: ObjectId.Start },
        { row: 1, column: 1, tile: TileId.Base, object: ObjectId.Start },
    ],
};

export function createPlayerServiceMock() {
    return {
        createSessionPlayers: jest.fn((room: RoomState, startCells) =>
            room.players.map((player, index) => ({
                id: player.id,
                name: player.name,
                avatar: player.avatar,
                playerType: player.playerType,
                maxHealth: player.character.maxHealth,
                health: player.character.health,
                speed: player.character.speed,
                attack: player.character.attack,
                defense: player.character.defense,
                baseAttack: player.character.attack,
                baseDefense: player.character.defense,
                attackDice: player.character.attackDice,
                defenseDice: player.character.defenseDice,
                movementPointsLeft: player.character.movementPointsLeft,
                combatSanctuaryPointsLeft: player.character.combatSanctuaryPointsLeft,
                actionsLeft: player.character.actionsLeft,
                combatsWon: 0,
                turnOrder: index + 1,
                isHost: room.hostId === player.id,
                hasAbandoned: false,
                hasFlag: false,
                position: { row: startCells[index].row, column: startCells[index].column },
            })),
        ),
        tryMoveActivePlayer: jest.fn(),
        tryPerformCombatAction: jest.fn().mockReturnValue({ id: 'player-2', name: 'Joueur 2' }),
        tryTeleportActivePlayer: jest.fn(),
        hasAvailableCombatAction: jest.fn().mockReturnValue(true),
        hasAvailableMove: jest.fn().mockReturnValue(true),
        resetTurnResources: jest.fn((player, actionsPerTurn) => {
            player.actionsLeft = actionsPerTurn;
            player.movementPointsLeft = player.speed;
        }),
    };
}
