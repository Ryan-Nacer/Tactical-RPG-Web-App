import { GameGateway, GameListUpdateType } from '@app/gateways/game/game.gateway';
import { GameDocument } from '@app/model/database/game';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { GameService } from '@app/services/game/game.service';
import { GameValidationService } from '@app/services/game/game.validation.service';
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';

describe('GameService', () => {
    const gameId = 'game-1';
    const gameName = 'Test Game';
    const gameSize = '10';
    const gameMode = 'CLASSIC';
    const httpStatusBadRequest = 400;
    const nonStringMessageValue = 123;
    const nonStringMessageItem = 3;

    let service: GameService;
    let gameModel: {
        create: jest.Mock;
        deleteOne: jest.Mock;
        find: jest.Mock;
        findOne: jest.Mock;
        findOneAndUpdate: jest.Mock;
    };
    let validationService: jest.Mocked<GameValidationService>;
    let gateway: jest.Mocked<GameGateway>;

    beforeEach(() => {
        gameModel = {
            create: jest.fn().mockResolvedValue(undefined),
            deleteOne: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            findOneAndUpdate: jest.fn(),
        };
        validationService = {
            checkNameRequired: jest.fn(),
            checkDescriptionRequired: jest.fn(),
            checkNameUniqueForCreate: jest.fn().mockResolvedValue(undefined),
            checkNameUniqueForUpdate: jest.fn().mockResolvedValue(undefined),
            checkDoors: jest.fn(),
            checkTerrainCoverage: jest.fn(),
            checkStartPoints: jest.fn(),
            checkFlagPlacement: jest.fn(),
            hasInaccessibleTiles: jest.fn(),
        } as unknown as jest.Mocked<GameValidationService>;
        gateway = { emitListUpdated: jest.fn() } as unknown as jest.Mocked<GameGateway>;

        service = new GameService(gameModel as unknown as Model<GameDocument>, validationService, gateway);
    });

    it('addGame should validate, create and emit list update', async () => {
        const dto: CreateGameDto = {
            id: gameId,
            name: gameName,
            description: 'Description',
            mode: gameMode,
            size: gameSize,
            isVisible: true,
            cells: [],
        };

        await service.addGame(dto);

        expect(validationService.checkNameRequired).toHaveBeenCalledWith(dto.name);
        expect(validationService.checkDescriptionRequired).toHaveBeenCalledWith(dto.description);
        expect(validationService.checkNameUniqueForCreate).toHaveBeenCalledWith(dto.name);
        expect(validationService.checkDoors).toHaveBeenCalledWith(dto.cells);
        expect(validationService.checkTerrainCoverage).toHaveBeenCalledWith(dto.cells);
        expect(validationService.checkStartPoints).toHaveBeenCalledWith(dto.cells, dto.size);
        expect(validationService.checkFlagPlacement).toHaveBeenCalledWith(dto.cells, dto.mode);
        expect(validationService.hasInaccessibleTiles).toHaveBeenCalledWith(dto.cells);
        expect(gameModel.create).toHaveBeenCalledWith(dto);
        expect(gateway.emitListUpdated).toHaveBeenCalledWith({
            type: GameListUpdateType.Created,
            gameId: dto.id,
            visible: dto.isVisible,
        });
    });

    it('addGame should throw when validation fails', async () => {
        const dto: CreateGameDto = {
            id: gameId,
            name: gameName,
            description: 'Description',
            mode: gameMode,
            size: gameSize,
            cells: [],
        };
        validationService.checkNameRequired.mockImplementation(() => {
            throw new BadRequestException('Validation error');
        });

        await expect(service.addGame(dto)).rejects.toBeInstanceOf(BadRequestException);
        expect(gameModel.create).not.toHaveBeenCalled();
    });

    it('deleteGame should throw when no record is deleted', async () => {
        gameModel.deleteOne.mockResolvedValue({ deletedCount: 0 });

        await expect(service.deleteGame(gameId)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateGame should update and emit visibility event', async () => {
        const update: UpdateGameDto = { isVisible: false };
        gameModel.findOneAndUpdate.mockResolvedValue({ id: gameId });

        await service.updateGame(gameId, update);

        expect(gameModel.findOneAndUpdate).toHaveBeenCalledWith({ id: gameId }, { $set: update }, { new: true });
        expect(gateway.emitListUpdated).toHaveBeenCalledWith({
            type: GameListUpdateType.Visibility,
            gameId,
            visible: update.isVisible,
        });
    });

    it('updateGame should throw when the game is not found', async () => {
        const update: UpdateGameDto = { name: gameName };
        gameModel.findOneAndUpdate.mockResolvedValue(null);

        await expect(service.updateGame(gameId, update)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updateGame should load existing size and mode when missing', async () => {
        const update: UpdateGameDto = { cells: [] };
        gameModel.findOne.mockResolvedValue({ size: gameSize, mode: gameMode });
        gameModel.findOneAndUpdate.mockResolvedValue({ id: gameId });

        await service.updateGame(gameId, update);

        expect(gameModel.findOne).toHaveBeenCalledWith({ id: gameId });
        expect(validationService.checkStartPoints).toHaveBeenCalledWith(update.cells, gameSize);
        expect(validationService.checkFlagPlacement).toHaveBeenCalledWith(update.cells, gameMode);
    });

    it('updateGame should validate description when provided', async () => {
        const update: UpdateGameDto = { description: 'New description' };
        gameModel.findOneAndUpdate.mockResolvedValue({ id: gameId });

        await service.updateGame(gameId, update);

        expect(validationService.checkDescriptionRequired).toHaveBeenCalledWith(update.description);
        expect(gameModel.findOneAndUpdate).toHaveBeenCalledWith({ id: gameId }, { $set: update }, { new: true });
    });

    it('updateGame should not load existing game when size and mode are provided', async () => {
        const update: UpdateGameDto = { cells: [], size: gameSize, mode: gameMode };
        gameModel.findOneAndUpdate.mockResolvedValue({ id: gameId });

        await service.updateGame(gameId, update);

        expect(gameModel.findOne).not.toHaveBeenCalled();
        expect(validationService.checkStartPoints).toHaveBeenCalledWith(update.cells, gameSize);
        expect(validationService.checkFlagPlacement).toHaveBeenCalledWith(update.cells, gameMode);
    });

    it('updateGame should load missing mode when size is provided', async () => {
        const update: UpdateGameDto = { cells: [], size: gameSize };
        gameModel.findOne.mockResolvedValue({ size: 'ignored', mode: gameMode });
        gameModel.findOneAndUpdate.mockResolvedValue({ id: gameId });

        await service.updateGame(gameId, update);

        expect(gameModel.findOne).toHaveBeenCalledWith({ id: gameId });
        expect(validationService.checkStartPoints).toHaveBeenCalledWith(update.cells, gameSize);
        expect(validationService.checkFlagPlacement).toHaveBeenCalledWith(update.cells, gameMode);
    });

    it('getAllGames should return all games', async () => {
        const games = [{ id: gameId }];
        gameModel.find.mockResolvedValue(games);

        await expect(service.getAllGames()).resolves.toEqual(games);
        expect(gameModel.find).toHaveBeenCalledWith({});
    });

    it('getVisibleGames should return only visible games', async () => {
        const games = [{ id: gameId, isVisible: true }];
        gameModel.find.mockResolvedValue(games);

        await expect(service.getVisibleGames()).resolves.toEqual(games);
        expect(gameModel.find).toHaveBeenCalledWith({ isVisible: true });
    });

    it('getGame should query by id', async () => {
        const game = { id: gameId };
        gameModel.findOne.mockResolvedValue(game);

        await expect(service.getGame(gameId)).resolves.toEqual(game);
        expect(gameModel.findOne).toHaveBeenCalledWith({ id: gameId });
    });

    it('addGame should rethrow HttpException from create', async () => {
        const dto: CreateGameDto = {
            id: gameId,
            name: gameName,
            description: 'Description',
            mode: gameMode,
            size: gameSize,
            isVisible: true,
            cells: [],
        };
        gameModel.create.mockRejectedValue(new BadRequestException('Create failed'));

        await expect(service.addGame(dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('addGame should wrap non-HttpException errors from create', async () => {
        const dto: CreateGameDto = {
            id: gameId,
            name: gameName,
            description: 'Description',
            mode: gameMode,
            size: gameSize,
            isVisible: true,
            cells: [],
        };
        gameModel.create.mockRejectedValue(new Error('boom'));

        await expect(service.addGame(dto)).rejects.toThrow("Echec de l'insertion du jeu. boom");
    });

    it('deleteGame should wrap non-HttpException errors', async () => {
        gameModel.deleteOne.mockRejectedValue(new Error('boom'));

        await expect(service.deleteGame(gameId)).rejects.toThrow('Echec de la suppression du jeu. boom');
    });

    it('updateGame should wrap non-HttpException errors', async () => {
        const update: UpdateGameDto = { isVisible: true };
        gameModel.findOneAndUpdate.mockRejectedValue(new Error('boom'));

        await expect(service.updateGame(gameId, update)).rejects.toThrow('Echec de la mise a jour du jeu. boom');
    });

    it('updateGame should throw BadRequestException when validation errors exist', async () => {
        const update: UpdateGameDto = { name: gameName };
        validationService.checkNameRequired.mockImplementation(() => {
            throw new HttpException(['err-1', 2, 'err-2'], httpStatusBadRequest);
        });

        await expect(service.updateGame(gameId, update)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should extract exception messages from various error shapes', () => {
        const extract = (service as unknown as { extractExceptionMessage: (error: unknown) => unknown }).extractExceptionMessage.bind(service);

        expect(extract(new HttpException(['a', 1, 'b'], httpStatusBadRequest))).toEqual(['a', 'b']);
        expect(extract(new HttpException('oops', httpStatusBadRequest))).toBe('oops');
        expect(extract(new HttpException({ message: ['x', nonStringMessageItem, 'y'] }, httpStatusBadRequest))).toEqual(['x', 'y']);
        expect(extract(new HttpException({ message: 'bad' }, httpStatusBadRequest))).toBe('bad');
        const nonStringMessage = new HttpException({ message: nonStringMessageValue }, httpStatusBadRequest);
        expect(extract(nonStringMessage)).toBe(nonStringMessage.message);
        expect(extract(new Error('boom'))).toBe('boom');
        expect(extract({ message: ['m1', 0, 'm2'] })).toEqual(['m1', 'm2']);
        expect(extract({ message: 'm3' })).toBe('m3');
        expect(extract(nonStringMessageValue)).toBeUndefined();
    });

    it('should format operation errors based on extracted message', () => {
        const format = (service as unknown as { formatOperationError: (prefix: string, error: unknown) => string }).formatOperationError.bind(
            service,
        );

        expect(format('Prefix', new HttpException(['a', 'b'], httpStatusBadRequest))).toBe('Prefix a, b');
        expect(format('Prefix', new Error('boom'))).toBe('Prefix boom');
        expect(format('Prefix', { message: '' })).toBe('Prefix');
    });

    it('should push validation errors based on extracted messages', async () => {
        const errors: string[] = [];
        const pushValidationError = (
            service as unknown as {
                pushValidationError: (errors: string[], error: unknown) => void;
            }
        ).pushValidationError.bind(service);
        const captureValidation = (
            service as unknown as {
                captureValidation: (errors: string[], fn: () => Promise<void> | void) => Promise<void>;
            }
        ).captureValidation.bind(service);

        pushValidationError(errors, new HttpException(['a', 1, 'b'], httpStatusBadRequest));
        pushValidationError(errors, new Error('boom'));
        pushValidationError(errors, nonStringMessageValue);
        await captureValidation(errors, () => {
            throw new HttpException('oops', httpStatusBadRequest);
        });

        expect(errors).toEqual(['a', 'b', 'boom', 'Erreur inconnue.', 'oops']);
    });
});
