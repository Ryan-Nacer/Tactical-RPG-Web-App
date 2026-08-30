import { RoomController } from '@app/controllers/room/room.controller';
import { RoomService } from '@app/services/room/room.service';
import { Test, TestingModule } from '@nestjs/testing';

/**
 * Strategie :
 * - tester RoomController comme facade HTTP minimale au-dessus de RoomService
 * - verifier que la route de salles joignables relaie directement la reponse du service
 *
 * Cas limites cibles :
 * - aucune transformation supplementaire cote controleur
 * - delegation exacte au service
 *
 * Ce controleur est simple, donc le but est surtout de proteger le contrat HTTP.
 */
describe('RoomController', () => {
    let controller: RoomController;
    let roomService: jest.Mocked<Pick<RoomService, 'getJoinableRooms'>>;

    beforeEach(async () => {
        roomService = {
            getJoinableRooms: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [RoomController],
            providers: [
                {
                    provide: RoomService,
                    useValue: roomService,
                },
            ],
        }).compile();

        controller = module.get(RoomController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('getJoinableRooms should return the service result', () => {
        const rooms = [
            { roomId: 'ABC123', hostName: 'Host', gameName: 'Test Game', currentPlayers: 1, maxPlayers: 2, isLocked: false, mode: 'CLASSIC' },
        ];
        roomService.getJoinableRooms.mockReturnValue(rooms);

        expect(controller.getJoinableRooms()).toBe(rooms);
        expect(roomService.getJoinableRooms).toHaveBeenCalled();
    });
});
