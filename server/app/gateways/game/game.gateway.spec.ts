import { GameGateway } from '@app/gateways/game/game.gateway';
import { GameEvents, GameListUpdatePayload, GameListUpdateType } from '@app/gateways/game/game.gateway.events';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Strategie :
 * - tester GameGateway comme fine couche de diffusion Socket.IO
 * - verifier a la fois le log emis et l'evenement diffuse, car les deux font partie
 *   du comportement observable du gateway
 *
 * Cas limites cibles :
 * - creation avec visibilite explicite
 * - changement de visibilite
 * - suppression sans champ "visible"
 *
 * Ces variantes representent les trois types de mise a jour de liste de jeux que le
 * client peut recevoir; elles doivent rester coherentes meme si le payload evolue.
 */
describe('GameGateway', () => {
    let gateway: GameGateway;
    let logger: jest.Mocked<Pick<Logger, 'log'>>;
    let server: jest.Mocked<Pick<Server, 'emit'>>;

    beforeEach(() => {
        logger = { log: jest.fn() };
        server = { emit: jest.fn() };
        gateway = new GameGateway(logger as unknown as Logger);
        (gateway as unknown as { server: Pick<Server, 'emit'> }).server = server;
    });

    it('should be defined', () => {
        expect(gateway).toBeDefined();
    });

    it.each([
        {
            name: 'creation payload',
            payload: { type: GameListUpdateType.Created, gameId: 'game-1', visible: true } satisfies GameListUpdatePayload,
        },
        {
            name: 'visibility payload',
            payload: { type: GameListUpdateType.Visibility, gameId: 'game-2', visible: false } satisfies GameListUpdatePayload,
        },
        {
            name: 'deletion payload',
            payload: { type: GameListUpdateType.Deleted, gameId: 'game-3' } satisfies GameListUpdatePayload,
        },
    ])('emitListUpdated should log and emit the $name', ({ payload }) => {
        gateway.emitListUpdated(payload);

        expect(logger.log).toHaveBeenCalledWith(`Liste des jeux mise a jour : ${payload.type} ${payload.gameId}`);
        expect(server.emit).toHaveBeenCalledWith(GameEvents.ListUpdated, payload);
    });
});
