export enum Mode {
    Classic = 'CLASSIC',
    CTF = 'CTF',
}

export enum TileId {
    Base = 'base',
    Wall = 'wall',
    Door = 'door',
    Water = 'water',
    Ice = 'ice',
}

export enum DoorState {
    Closed = 'closed',
    Open = 'open',
}

export enum ObjectId {
    Start = 'start',
    Flag = 'flag',
    Heal = 'heal',
    Combat = 'combat',
}

export enum ShrinePart {
    TopLeft = 'top-left',
    TopRight = 'top-right',
    BottomLeft = 'bottom-left',
    BottomRight = 'bottom-right',
}

const TERRAIN_TILES = [TileId.Base, TileId.Water, TileId.Ice];

export const CARDINAL_NEIGHBOR_OFFSETS: ReadonlyArray<{ row: number; column: number }> = [
    { row: -1, column: 0 },
    { row: 1, column: 0 },
    { row: 0, column: -1 },
    { row: 0, column: 1 },
];

export function isTileTool(tool: Tool): tool is TileId {
    return Object.values(TileId).includes(tool as TileId);
}

export function isObjectTool(tool: Tool): tool is ObjectId {
    return Object.values(ObjectId).includes(tool as ObjectId);
}

export function isTerrainTile(tile: TileId): boolean {
    return TERRAIN_TILES.includes(tile);
}

export function getTerrainMovementCost(tile: TileId): number {
    switch (tile) {
        case TileId.Water:
            return 2;
        case TileId.Ice:
            return 0;
        case TileId.Base:
        case TileId.Door:
        default:
            return 1;
    }
}

export type Tool = TileId | ObjectId;

export interface GameCell {
    row: number;
    column: number;
    tile: TileId;
    object?: ObjectId;
    doorState?: DoorState;
    shrineId?: string;
    shrinePart?: ShrinePart;
    shrineCooldownTurns?: number;
    //
    doorManipulated?: boolean;
    shrineUsed?: boolean;
}

export interface Game {
    id: string;
    name: string;
    size: GridSize;
    lastModified: string;
    description: string;
    mode: Mode;
    isVisible: boolean;
    imageURL?: string;
    cells: GameCell[];
}

export enum GridSize {
    Small = 10,
    Medium = 15,
    Large = 20,
}

export const emptyGame = (): Game => ({
    id: '',
    name: '',
    size: GridSize.Small,
    lastModified: '',
    description: '',
    mode: Mode.Classic,
    isVisible: false,
    cells: [],
});
