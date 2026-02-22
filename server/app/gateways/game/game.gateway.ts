import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { GameEvents } from './game.gateway.events';

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

@WebSocketGateway({ cors: true })
@Injectable()
export class GameGateway {
    @WebSocketServer() private server: Server;

    constructor(private readonly logger: Logger) {}

    emitListUpdated(payload: GameListUpdatePayload): void {
        this.logger.log(`Liste des jeux mise a jour : ${payload.type} ${payload.gameId}`);
        this.server.emit(GameEvents.ListUpdated, payload);
    }
}
