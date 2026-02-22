import { GameGateway, GameListUpdateType } from '@app/gateways/game/game.gateway';
import { GameDocument, Games } from '@app/model/database/game';
import { GameService } from '@app/services/game/game.service';
import { GameValidationService } from '@app/services/game/game.validation.service';
import { Model } from 'mongoose';

describe('GameService DB', () => {
    const gameId = 'game-1';

    let service: GameService;
    let gameModel: {
        deleteOne: jest.Mock;
        find: jest.Mock;
        findOne: jest.Mock;
    };
    let validationService: jest.Mocked<GameValidationService>;
    let gateway: jest.Mocked<GameGateway>;

    beforeEach(() => {
        gameModel = {
            deleteOne: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
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

    it('getAllGames should query the database model', async () => {
        const storedGames: Games[] = [{ id: gameId } as Games];
        gameModel.find.mockResolvedValue(storedGames);

        const result = await service.getAllGames();

        expect(gameModel.find).toHaveBeenCalledWith({});
        expect(result).toBe(storedGames);
    });

    it('getVisibleGames should query visible games only', async () => {
        const storedGames: Games[] = [{ id: gameId } as Games];
        gameModel.find.mockResolvedValue(storedGames);

        const result = await service.getVisibleGames();

        expect(gameModel.find).toHaveBeenCalledWith({ isVisible: true });
        expect(result).toBe(storedGames);
    });

    it('getGame should query by id', async () => {
        const storedGame = { id: gameId } as Games;
        gameModel.findOne.mockResolvedValue(storedGame);

        const result = await service.getGame(gameId);

        expect(gameModel.findOne).toHaveBeenCalledWith({ id: gameId });
        expect(result).toBe(storedGame);
    });

    it('deleteGame should remove a game and emit list update', async () => {
        gameModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

        await service.deleteGame(gameId);

        expect(gameModel.deleteOne).toHaveBeenCalledWith({ id: gameId });
        expect(gateway.emitListUpdated).toHaveBeenCalledWith({
            type: GameListUpdateType.Deleted,
            gameId,
        });
    });
});
