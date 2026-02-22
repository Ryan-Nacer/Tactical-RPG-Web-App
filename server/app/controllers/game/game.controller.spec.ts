import { GAME_CREATED_MSG, UNKNOWN_ERROR } from '@app/controllers/controller.constants';
import { GameController } from '@app/controllers/game/game.controller';
import { Games } from '@app/model/database/game';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { GameService } from '@app/services/game/game.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

describe('GameController', () => {
    const gameId = 'game-1';
    const gameName = 'Test Game';
    const gameSize = '10';
    const gameMode = 'CLASSIC';
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

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('allGames should return games', async () => {
        const games = [mockGame];
        gameService.getAllGames.mockResolvedValue(games);

        const result = await controller.allGames();

        expect(result).toBe(games);
    });

    it('allGames should throw NOT_FOUND when service fails', async () => {
        let caught: HttpException | undefined;
        gameService.getAllGames.mockRejectedValue(new Error('Database error'));

        try {
            await controller.allGames();
        } catch (error) {
            if (error instanceof HttpException) {
                caught = error;
            }
        }

        expect(caught).toBeDefined();
        expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('visibleGames should return games', async () => {
        const games = [mockGame];
        gameService.getVisibleGames.mockResolvedValue(games);

        const result = await controller.visibleGames();

        expect(result).toBe(games);
    });

    it('visibleGames should throw NOT_FOUND when service fails', async () => {
        let caught: HttpException | undefined;
        gameService.getVisibleGames.mockRejectedValue(new Error('Database error'));

        try {
            await controller.visibleGames();
        } catch (error) {
            if (error instanceof HttpException) {
                caught = error;
            }
        }

        expect(caught).toBeDefined();
        expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
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

    it('addGame should throw BAD_REQUEST when service fails', async () => {
        let caught: HttpException | undefined;
        gameService.addGame.mockRejectedValue(new Error('Insert failed'));

        try {
            await controller.addGame(createDto);
        } catch (error) {
            if (error instanceof HttpException) {
                caught = error;
            }
        }

        expect(caught).toBeDefined();
        expect(caught?.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('getGameById should return a game', async () => {
        gameService.getGame.mockResolvedValue(mockGame);

        const result = await controller.getGameById(gameId);

        expect(result).toBe(mockGame);
    });

    it('getGameById should throw NOT_FOUND when service fails', async () => {
        let caught: HttpException | undefined;
        gameService.getGame.mockRejectedValue(new Error('Not found'));

        try {
            await controller.getGameById(gameId);
        } catch (error) {
            if (error instanceof HttpException) {
                caught = error;
            }
        }

        expect(caught).toBeDefined();
        expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
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

    it('updateGame should throw NOT_FOUND when service fails', async () => {
        let caught: HttpException | undefined;
        const updateDto: UpdateGameDto = { name: 'Updated Game' };
        gameService.updateGame.mockRejectedValue(new Error('Update failed'));

        try {
            await controller.updateGame(gameId, updateDto);
        } catch (error) {
            if (error instanceof HttpException) {
                caught = error;
            }
        }

        expect(caught).toBeDefined();
        expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('deleteGame should call the service', async () => {
        gameService.deleteGame.mockResolvedValue(undefined);

        await controller.deleteGame(gameId);

        expect(gameService.deleteGame).toHaveBeenCalledWith(gameId);
    });

    it('deleteGame should throw NOT_FOUND with unknown error message', async () => {
        let caught: HttpException | undefined;
        gameService.deleteGame.mockRejectedValue('Unknown');

        try {
            await controller.deleteGame(gameId);
        } catch (error) {
            if (error instanceof HttpException) {
                caught = error;
            }
        }

        expect(caught).toBeDefined();
        expect(caught?.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(caught?.getResponse()).toBe(UNKNOWN_ERROR);
    });
});
