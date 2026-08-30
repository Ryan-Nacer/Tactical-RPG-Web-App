export enum GameEvents {
    ListUpdated = 'gameListUpdated',
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
