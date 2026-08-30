import { GameListUpdateType } from '@app/interfaces/game';
import { GameSocketService, gameSocketClientFactory } from './game-socket.service';

/**
 * Strategie :
 * - tester GameSocketService comme couche cliente minimale de synchronisation temps reel
 * - verifier le relais de l'evenement de liste et le nettoyage du socket
 *
 * Cas limites cibles :
 * - le payload recu doit etre retransmis tel quel
 * - ngOnDestroy doit retirer le listener et fermer la connexion
 */
describe('GameSocketService', () => {
    const gameListUpdatedEvent = 'gameListUpdated';

    let callbacks: Map<string, (payload: unknown) => void>;
    let mockSocket: {
        on: jasmine.Spy;
        removeAllListeners: jasmine.Spy;
        disconnect: jasmine.Spy;
    };
    let service: GameSocketService;

    beforeEach(() => {
        callbacks = new Map();
        mockSocket = {
            on: jasmine.createSpy('on').and.callFake((event: string, callback: (payload: unknown) => void) => {
                callbacks.set(event, callback);
                return mockSocket;
            }),
            removeAllListeners: jasmine.createSpy('removeAllListeners'),
            disconnect: jasmine.createSpy('disconnect'),
        };

        spyOn(gameSocketClientFactory, 'create').and.returnValue(mockSocket as never);
        service = new GameSocketService();
    });

    afterEach(() => {
        service?.ngOnDestroy();
    });

    it('should relay game list updates emitted by the socket', () => {
        let receivedPayload:
            | {
                  type: GameListUpdateType;
                  gameId: string;
                  visible?: boolean;
              }
            | undefined;
        const payload = { type: GameListUpdateType.Visibility, gameId: 'game-1', visible: false };

        service.gameListUpdated$.subscribe((update) => (receivedPayload = update));
        callbacks.get(gameListUpdatedEvent)?.(payload);

        expect(receivedPayload).toEqual(payload);
    });

    it('should remove the list update listener and disconnect on destroy', () => {
        service.ngOnDestroy();

        expect(mockSocket.removeAllListeners).toHaveBeenCalledWith(gameListUpdatedEvent);
        expect(mockSocket.disconnect).toHaveBeenCalled();
    });
});
