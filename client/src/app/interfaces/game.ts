import { DoorState, GridSize, Mode, ObjectId, ShrinePart, TileId } from '@common/game';

export interface GameSetupData {
    mode: Mode;
    size: GridSize;
}

export enum GameListUpdateType {
    Deleted = 'deleted',
    Visibility = 'visibility',
    Created = 'created',
}

export interface GameListUpdatePayload {
    type: GameListUpdateType;
    gameId: string;
    visible?: boolean;
}

export interface GameGridCell {
    readonly row: number;
    readonly column: number;
    readonly tile: TileId;
    readonly object?: ObjectId;
    readonly doorState?: DoorState;
    readonly shrineId?: string;
    readonly shrinePart?: ShrinePart;
    readonly shrineCooldownTurns?: number;
}

export enum MouseButton {
    Left = 0,
    Right = 2,
}

export interface GameGridPointerEvent {
    readonly cell: GameGridCell;
    readonly button: MouseButton;
    readonly shiftKey: boolean;
}

export interface GameGridInspectEvent {
    readonly cell: GameGridCell;
    readonly shiftKey: boolean;
    readonly clientX: number;
    readonly clientY: number;
}

export interface GameGridRightClickEvent {
    readonly cell: GameGridCell;
    readonly shiftKey: boolean;
}

export interface GameGridPlayerMarker {
    readonly id: string;
    readonly name: string;
    readonly row: number;
    readonly column: number;
    readonly avatarImageUrl?: string;
    readonly isActive?: boolean;
    readonly team?: 'A' | 'B';
}

export interface GameGridReachableCell {
    readonly row: number;
    readonly column: number;
    readonly targetType?: 'default' | 'transfer';
}

export interface GameGridPlacementPreview {
    readonly cells: GameGridReachableCell[];
    readonly isValid: boolean;
    readonly imageSrc?: string;
    readonly topLeft?: GameGridReachableCell;
}

export type GamePageCountdownState = 'normal' | 'warning' | 'danger' | 'transition' | 'combat' | 'disabled';
