import { GameGateway, GameListUpdatePayload, GameListUpdateType } from '@app/gateways/game/game.gateway';
import { GameEvents } from '@app/gateways/game/game.gateway.events';
import { Logger } from '@nestjs/common';

describe('GameGateway', () => {
    const gameId = 'game-1';
    let gateway: GameGateway;
    let emitMock: jest.Mock;
    let logger: Logger;

    beforeEach(() => {
        logger = { log: jest.fn() } as unknown as Logger;
        gateway = new GameGateway(logger);
        emitMock = jest.fn();
        (gateway as unknown as { server: { emit: jest.Mock } }).server = { emit: emitMock };
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    it('emitListUpdated should log and emit the payload', () => {
        const payload: GameListUpdatePayload = {
            type: GameListUpdateType.Created,
            gameId,
            visible: true,
        };

        gateway.emitListUpdated(payload);

        expect(logger.log).toHaveBeenCalledWith(`Liste des jeux mise a jour : ${payload.type} ${payload.gameId}`);
        expect(emitMock).toHaveBeenCalledWith(GameEvents.ListUpdated, payload);
    });
});
