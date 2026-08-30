import { GAME_CREATED_MSG, UNKNOWN_ERROR } from '@app/controllers/controller.constants';
import { GameController } from '@app/controllers/game/game.controller';
import { Games } from '@app/model/database/game';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { GameService } from '@app/services/game/game.service';
import { GridSize, Mode } from '@common/game';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

/**
 * Strategie :
 * - tester GameController comme adaptateur HTTP au-dessus de GameService
 * - verifier que les reponses nominales du service sont relayees telles quelles
 * - verifier que les erreurs du service sont converties vers les bons statuts HTTP
 *
 * Cas limites cibles :
 * - erreurs generiques sur les routes de lecture, qui doivent devenir des INTERNAL_SERVER_ERROR
 * - HttpException deja formatees par le service, qui doivent etre preservees
 * - erreurs non typées, qui doivent devenir UNKNOWN_ERROR a la suppression
 *
 * Ces cas sont critiques parce que le controleur constitue le contrat observe par le client.
 */
describe('GameController', () => {
    const gameId = 'game-1';
    const gameName = 'Test Game';
    const gameSize = GridSize.Small;
    const gameMode = Mode.Classic;
    const gameDescription = 'Description';

    let controller: GameController;
    let gameService: jest.Mocked<GameService>;

    const mockGame: Games = {
        id: gameId,
        name: gameName,
        mode: gameMode,
        size: gameSize,
        description: gameDescription,
        isVisible: true,
        cells: [],
    };

    const createDto: CreateGameDto = {
        id: gameId,
        name: gameName,
        description: gameDescription,
        mode: gameMode,
        size: gameSize,
        isVisible: true,
        cells: [],
    };

    beforeEach(async () => {
        const mockGameService = {
            getAllGames: jest.fn(),
            getVisibleGames: jest.fn(),
            addGame: jest.fn(),
            getGame: jest.fn(),
            updateGame: jest.fn(),
            deleteGame: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [GameController],
            providers: [
                {
                    provide: GameService,
                    useValue: mockGameService,
                },
            ],
        }).compile();

        controller = module.get<GameController>(GameController);
        gameService = module.get(GameService);
    });

    const captureHttpException = async (action: () => Promise<unknown>): Promise<HttpException> => {
        try {
            await action();
            throw new Error('Expected HttpException to be thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(HttpException);
            return error as HttpException;
        }
    };

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it.each([
        {
            name: 'allGames',
            serviceCall: () => gameService.getAllGames,
            action: () => controller.allGames(),
        },
        {
            name: 'visibleGames',
            serviceCall: () => gameService.getVisibleGames,
            action: () => controller.visibleGames(),
        },
    ])('$name should return games', async ({ serviceCall, action }) => {
        const games = [mockGame];
        serviceCall().mockResolvedValue(games);

        await expect(action()).resolves.toBe(games);
    });

    it.each([
        {
            name: 'allGames',
            serviceCall: () => gameService.getAllGames,
            action: () => controller.allGames(),
        },
        {
            name: 'visibleGames',
            serviceCall: () => gameService.getVisibleGames,
            action: () => controller.visibleGames(),
        },
    ])('$name should throw INTERNAL_SERVER_ERROR when service fails', async ({ serviceCall, action }) => {
        serviceCall().mockRejectedValue(new Error('Database error'));

        const caught = await captureHttpException(action);

        expect(caught.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('addGame should return created message and id', async () => {
        gameService.addGame.mockResolvedValue(undefined);

        const result = await controller.addGame(createDto);

        expect(result).toEqual({ message: GAME_CREATED_MSG, id: createDto.id });
    });

    it('addGame should rethrow HttpException from service', async () => {
        const httpError = new HttpException('Conflict', HttpStatus.CONFLICT);
        gameService.addGame.mockRejectedValue(httpError);

        await expect(controller.addGame(createDto)).rejects.toBe(httpError);
    });

    it('addGame should throw INTERNAL_SERVER_ERROR when service fails', async () => {
        gameService.addGame.mockRejectedValue(new Error('Insert failed'));

        const caught = await captureHttpException(() => controller.addGame(createDto));

        expect(caught.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('getGameById should return a game', async () => {
        gameService.getGame.mockResolvedValue(mockGame);

        const result = await controller.getGameById(gameId);

        expect(result).toBe(mockGame);
    });

    it('getGameById should throw NOT_FOUND when the game is missing', async () => {
        gameService.getGame.mockResolvedValue(null as unknown as Games);

        const caught = await captureHttpException(() => controller.getGameById(gameId));

        expect(caught.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('getGameById should throw INTERNAL_SERVER_ERROR when service fails', async () => {
        gameService.getGame.mockRejectedValue(new Error('Database error'));

        const caught = await captureHttpException(() => controller.getGameById(gameId));

        expect(caught.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('updateGame should call the service', async () => {
        const updateDto: UpdateGameDto = { name: 'Updated Game' };
        gameService.updateGame.mockResolvedValue(undefined);

        await controller.updateGame(gameId, updateDto);

        expect(gameService.updateGame).toHaveBeenCalledWith(gameId, updateDto);
    });

    it('updateGame should rethrow HttpException from service', async () => {
        const updateDto: UpdateGameDto = { name: 'Updated Game' };
        const httpError = new HttpException('Not found', HttpStatus.NOT_FOUND);
        gameService.updateGame.mockRejectedValue(httpError);

        await expect(controller.updateGame(gameId, updateDto)).rejects.toBe(httpError);
    });

    it('updateGame should throw INTERNAL_SERVER_ERROR when service fails', async () => {
        const updateDto: UpdateGameDto = { name: 'Updated Game' };
        gameService.updateGame.mockRejectedValue(new Error('Update failed'));

        const caught = await captureHttpException(() => controller.updateGame(gameId, updateDto));

        expect(caught.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('deleteGame should call the service', async () => {
        gameService.deleteGame.mockResolvedValue(undefined);

        await controller.deleteGame(gameId);

        expect(gameService.deleteGame).toHaveBeenCalledWith(gameId);
    });

    it('deleteGame should throw INTERNAL_SERVER_ERROR with unknown error message', async () => {
        gameService.deleteGame.mockRejectedValue('Unknown');

        const caught = await captureHttpException(() => controller.deleteGame(gameId));

        expect(caught.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(caught.getResponse()).toEqual({
            message: UNKNOWN_ERROR,
            error: 'Internal Server Error',
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        });
    });
});
