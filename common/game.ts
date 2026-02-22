export const enum Mode {
    Classic = 'CLASSIC',
    CTF = 'CTF'
}

export enum TileId {
  Base = 'base',
  Wall =  'wall',
  Door = 'door',
  Water = 'water',
  Ice ='ice',
}

export enum ObjectId {
  Start = 'start',
  Flag = 'flag',
  Heal = 'heal',
  Combat = 'combat',
}

const TERRAIN_TILES = [TileId.Base, TileId.Water, TileId.Ice];

export function isTileTool(tool: Tool): tool is TileId {
    return Object.values(TileId).includes(tool as TileId);
  }

export function isObjectTool(tool: Tool): tool is ObjectId {
  return Object.values(ObjectId).includes(tool as ObjectId);
}

export function isTerrainTile(tile: TileId): boolean {
    return TERRAIN_TILES.includes(tile);
}


export type Tool = TileId | ObjectId;

export interface GameCell {
  row: number;
  column: number;
  tile: TileId;
  object?: ObjectId;
}

export interface Game {
    id: string;
    name: string;
    size: string;
    lastModified: string;
    description: string;
    mode: Mode;
    isVisible: boolean;
    imageURL?: string;
    cells: GameCell[];
}
