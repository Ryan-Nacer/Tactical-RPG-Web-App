import { CHAT_EVENTS } from '@common/chat-events';
import { ChatMessage } from '@common/chat-message';
import { ChatSocketService, chatSocketClientFactory } from './chat-socket.service';

/**
 * Strategie :
 * - tester ChatSocketService comme adaptateur client du chat temps reel
 * - verifier les changements de salle, le filtrage des messages entrants et les emissions
 *   effectuees par les actions utilisateur
 *
 * Cas limites cibles :
 * - joinRoom avec une salle vide ou identique ne doit rien faire
 * - un message d'une autre salle doit etre ignore
 * - quitter la salle active doit vider l'historique local
 */
describe('ChatSocketService', () => {
    let callbacks: Map<string, (payload: unknown) => void>;
    let mockSocket: {
        emit: jasmine.Spy;
        on: jasmine.Spy;
        disconnect: jasmine.Spy;
    };
    let service: ChatSocketService;

    beforeEach(() => {
        callbacks = new Map();
        mockSocket = {
            emit: jasmine.createSpy('emit'),
            on: jasmine.createSpy('on').and.callFake((event: string, callback: (payload: unknown) => void) => {
                callbacks.set(event, callback);
                return mockSocket;
            }),
            disconnect: jasmine.createSpy('disconnect'),
        };

        spyOn(chatSocketClientFactory, 'create').and.returnValue(mockSocket as never);
        service = new ChatSocketService();
    });

    afterEach(() => {
        service?.ngOnDestroy();
    });

    it('should emit a chat message with the formatted payload', () => {
        spyOn(Date.prototype, 'toLocaleTimeString').and.returnValue('12:34:56');

        service.sendMessage('ROOM01', 'Alice', 'Bonjour', 'player-1');

        expect(mockSocket.emit).toHaveBeenCalledWith(CHAT_EVENTS.SendMessage, {
            roomId: 'ROOM01',
            sender: 'Alice',
            text: 'Bonjour',
            time: '12:34:56',
            playerId: 'player-1',
        });
    });

    it('should join a room once and ignore empty or duplicate requests', () => {
        service.joinRoom('');
        service.joinRoom('ROOM01');
        service.joinRoom('ROOM01');

        expect(mockSocket.emit.calls.allArgs()).toEqual([[CHAT_EVENTS.JoinRoom, 'ROOM01']]);
    });

    it('should leave the previous room before joining a different one', () => {
        service.joinRoom('ROOM01');
        service.joinRoom('ROOM02');

        expect(mockSocket.emit.calls.allArgs()).toEqual([
            [CHAT_EVENTS.JoinRoom, 'ROOM01'],
            [CHAT_EVENTS.LeaveRoom, 'ROOM01'],
            [CHAT_EVENTS.JoinRoom, 'ROOM02'],
        ]);
    });

    it('should append messages from the active room only', () => {
        const receivedMessages: ChatMessage[][] = [];
        const roomMessage: ChatMessage = {
            roomId: 'ROOM01',
            sender: 'Alice',
            text: 'Bonjour',
            time: '12:34:56',
            playerId: 'player-1',
        };
        const otherRoomMessage: ChatMessage = {
            ...roomMessage,
            roomId: 'ROOM02',
            text: 'Ignore-moi',
        };

        service.messages$.subscribe((messages) => receivedMessages.push(messages));
        service.joinRoom('ROOM01');
        callbacks.get(CHAT_EVENTS.Message)?.(otherRoomMessage);
        callbacks.get(CHAT_EVENTS.Message)?.(roomMessage);

        expect(receivedMessages[receivedMessages.length - 1]).toEqual([roomMessage]);
    });

    it('should clear the history when leaving the active room and still emit the leave event', () => {
        const receivedMessages: ChatMessage[][] = [];
        const roomMessage: ChatMessage = {
            roomId: 'ROOM01',
            sender: 'Alice',
            text: 'Bonjour',
            time: '12:34:56',
            playerId: 'player-1',
        };

        service.messages$.subscribe((messages) => receivedMessages.push(messages));
        service.joinRoom('ROOM01');
        callbacks.get(CHAT_EVENTS.Message)?.(roomMessage);
        service.leaveRoom('ROOM01');

        expect(receivedMessages[receivedMessages.length - 1]).toEqual([]);
        expect(mockSocket.emit.calls.allArgs()).toContain([CHAT_EVENTS.LeaveRoom, 'ROOM01']);
    });

    it('should ignore empty leave requests and leave non-active rooms without clearing the active one', () => {
        const receivedMessages: ChatMessage[][] = [];
        const roomMessage: ChatMessage = {
            roomId: 'ROOM01',
            sender: 'Alice',
            text: 'Bonjour',
            time: '12:34:56',
            playerId: 'player-1',
        };

        service.messages$.subscribe((messages) => receivedMessages.push(messages));
        service.joinRoom('ROOM01');
        callbacks.get(CHAT_EVENTS.Message)?.(roomMessage);
        service.leaveRoom('');
        service.leaveRoom('ROOM99');

        expect(receivedMessages[receivedMessages.length - 1]).toEqual([roomMessage]);
        expect(mockSocket.emit.calls.allArgs()).toContain([CHAT_EVENTS.LeaveRoom, 'ROOM99']);
    });

    it('should disconnect on destroy', () => {
        service.ngOnDestroy();

        expect(mockSocket.disconnect).toHaveBeenCalled();
    });
});
