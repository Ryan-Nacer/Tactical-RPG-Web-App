import { UNKNOWN_ERROR } from '@app/controllers/controller.constants';
import { GameFromSessionController } from '@app/controllers/game-from-session/game-from-session.controller';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { CreateGameDtoMapper } from '@app/model/dto/mappers/create-game-dto-mapper';
import { GameService } from '@app/services/game/game.service';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Game, GridSize, Mode, ObjectId, TileId } from '@common/game';

/**
 * Strategie :
 * - tester GameFromSessionController comme facade HTTP qui persiste un jeu cree depuis une session
 * - verifier le mapping du payload et la propagation correcte des erreurs du service
 *
 * Cas limites cibles :
 * - erreur de mapping avant l'appel au service
 * - erreurs serveur typees et non typees lors de l'ajout
 */
describe('GameFromSessionController', () => {
    let controller: GameFromSessionController;
    let gameService: jest.Mocked<Pick<GameService, 'addGame'>>;

    const mockGame: Game = {
        id: '1',
        name: 'Test Game',
        description: 'A test game',
        mode: Mode.Classic,
        size: GridSize.Small,
        lastModified: '2026-01-25',
        isVisible: true,
        cells: [
            { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
            { row: 0, column: 1, tile: TileId.Base },
        ],
    };

    const mappedDto: CreateGameDto = {
        id: '1',
        name: 'Test Game',
        description: 'A test game',
        mode: Mode.Classic,
        size: GridSize.Small,
        lastModified: '2026-01-25',
        cells: mockGame.cells,
    };

    const gameFromSession = {
        name: mockGame.name,
        gameData: mockGame,
    };

    beforeEach(async () => {
        gameService = {
            addGame: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [GameFromSessionController],
            providers: [
                {
                    provide: GameService,
                    useValue: gameService,
                },
            ],
        }).compile();

        controller = module.get<GameFromSessionController>(GameFromSessionController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should save game from session data successfully', async () => {
        jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(mappedDto);

        const result = await controller.saveGameFromSession(gameFromSession);

        expect(CreateGameDtoMapper.toDto).toHaveBeenCalledWith(gameFromSession.gameData);
        expect(gameService.addGame).toHaveBeenCalledWith(mappedDto);
        expect(result).toEqual({
            message: `Jeu '${gameFromSession.name}' sauvegarde avec succes`,
            game: mappedDto,
        });
    });

    it('should throw BAD_REQUEST on DTO mapping errors', async () => {
        jest.spyOn(CreateGameDtoMapper, 'toDto').mockImplementation(() => {
            throw new Error('Mapping error');
        });

        await expect(controller.saveGameFromSession(gameFromSession)).rejects.toMatchObject({
            response: {
                message: 'Mapping error',
                error: 'Bad Request',
                statusCode: HttpStatus.BAD_REQUEST,
            },
        });
    });

    it('should throw INTERNAL_SERVER_ERROR when saving fails with a generic error', async () => {
        jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(mappedDto);
        gameService.addGame.mockRejectedValue(new Error('Database error'));

        await expect(controller.saveGameFromSession(gameFromSession)).rejects.toMatchObject({
            response: {
                message: 'Database error',
                error: 'Internal Server Error',
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            },
        });
    });

    it('should handle non-Error rejections with unknown error', async () => {
        jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(mappedDto);
        gameService.addGame.mockRejectedValue('Unknown');

        await expect(controller.saveGameFromSession(gameFromSession)).rejects.toMatchObject({
            response: {
                message: UNKNOWN_ERROR,
                error: 'Internal Server Error',
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            },
        });
    });

    it('should rethrow HttpException from service', async () => {
        const httpError = new BadRequestException('Validation failed');
        jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(mappedDto);
        gameService.addGame.mockRejectedValue(httpError);

        await expect(controller.saveGameFromSession(gameFromSession)).rejects.toBe(httpError);
    });
});
