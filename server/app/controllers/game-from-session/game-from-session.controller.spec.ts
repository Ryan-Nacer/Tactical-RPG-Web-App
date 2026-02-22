import { UNKNOWN_ERROR } from '@app/controllers/controller.constants';
import { GameFromSessionController, SaveGameResponse } from '@app/controllers/game-from-session/game-from-session.controller';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { CreateGameDtoMapper } from '@app/model/dto/mappers/create-game-dto-mapper';
import { GameService } from '@app/services/game/game.service';
import { Test, TestingModule } from '@nestjs/testing';
import { TileId, ObjectId, Mode, Game, GameCell } from '@common/game';

let controller: GameFromSessionController;
let gameService: jest.Mocked<GameService>;

describe('GameFromSessionController', () => {
    const mockGameCells: GameCell[] = [
        { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
        { row: 0, column: 1, tile: TileId.Base },
        { row: 0, column: 2, tile: TileId.Wall },
        { row: 1, column: 0, tile: TileId.Base },
        { row: 1, column: 1, tile: TileId.Water },
        { row: 1, column: 2, tile: TileId.Door },
        { row: 2, column: 0, tile: TileId.Ice },
        { row: 2, column: 1, tile: TileId.Base },
        { row: 2, column: 2, tile: TileId.Base, object: ObjectId.Flag },
    ];

    const mockGames: Game[] = [
        {
            id: '1',
            name: 'Test Game',
            description: 'A test game',
            mode: Mode.Classic,
            size: '100MB',
            lastModified: '2026-01-25',
            imageURL: 'http://example.com/image.jpg',
            isVisible: true,
            cells: mockGameCells,
        },
        {
            id: '2',
            name: 'Test Game2',
            description: 'A test game',
            mode: Mode.CTF,
            size: '100MB',
            lastModified: '2026-01-25',
            imageURL: 'http://example.com/image.jpg',
            isVisible: false,
            cells: mockGameCells,
        },
    ];

    const baseGameFromSession = {
        name: mockGames[0].name,
        gameData: mockGames[0],
    };

    const mockGameDto: CreateGameDto = {
        id: mockGames[0].id,
        name: mockGames[0].name,
        description: mockGames[0].description,
        mode: mockGames[0].mode,
        size: mockGames[0].size,
        lastModified: mockGames[0].lastModified,
        imageURL: mockGames[0].imageURL,
        cells: mockGames[0].cells,
    };

    beforeEach(async () => {
        const mockGameService = {
            addGame: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [GameFromSessionController],
            providers: [
                {
                    provide: GameService,
                    useValue: mockGameService,
                },
            ],
        }).compile();

        controller = module.get<GameFromSessionController>(GameFromSessionController);
        gameService = module.get(GameService);

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('saveGameFromSession', () => {
        it('should save game from session data successfully', async () => {
            // Arrange
            const gameFromSession = {
                name: 'testGame',
                gameData: {
                    id: '1',
                    name: 'Test Game',
                    description: 'A test game',
                    mode: Mode.Classic,
                    size: '10',
                    lastModified: '2026-01-25',
                    isVisible: true,
                    cells: [],
                },
            };
            const mockGameDtoLocal: CreateGameDto = {
                id: '1',
                name: 'Test Game',
                description: 'A test game',
                mode: Mode.Classic,
                size: '10',
                cells: [],
                lastModified: '2026-01-25',
            };

            // Mock the CreateGameDtoMapper.toDto method
            jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(mockGameDtoLocal);
            gameService.addGame.mockResolvedValue(undefined);

            const result = await controller.saveGameFromSession(gameFromSession);

            expect(CreateGameDtoMapper.toDto).toHaveBeenCalledWith(gameFromSession.gameData);
            expect(gameService.addGame).toHaveBeenCalledWith(mockGameDtoLocal);
            expect(result).toEqual({
                success: true,
                message: `Jeu '${gameFromSession.name}' sauvegardé avec succès`,
                game: mockGameDtoLocal,
            });
        });

        it('should handle errors when saving game', async () => {
            // Arrange
            const gameFromSession = {
                name: 'errorGame',
                gameData: {
                    id: '1',
                    name: 'Error Game',
                    description: 'Error description',
                    mode: Mode.Classic,
                    size: '10',
                    isVisible: true,
                    cells: [],
                },
            };
            const errorMessage = 'Database error';
            const mockDto: CreateGameDto = {
                id: '1',
                name: 'Error Game',
                description: 'Error description',
                mode: Mode.Classic,
                size: '10',
                lastModified: '2026-01-25',
            };

            jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(mockDto);
            gameService.addGame.mockRejectedValue(new Error(errorMessage));

            const result: SaveGameResponse = await controller.saveGameFromSession(gameFromSession);

            expect(result).toEqual({
                success: false,
                message: `Erreur lors de la sauvegarde du jeu '${gameFromSession.name}': ${errorMessage}`,
                error: errorMessage,
            });
        });

        it('should handle DTO mapping errors', async () => {
            // Arrange
            const gameFromSession = {
                name: 'mappingErrorGame',
                gameData: {
                    id: '1',
                    name: 'Invalid Game',
                    description: 'Invalid description',
                    mode: Mode.Classic,
                    size: '10',
                    isVisible: true,
                    cells: [],
                },
            };

            jest.spyOn(CreateGameDtoMapper, 'toDto').mockImplementation(() => {
                throw new Error('Mapping error');
            });

            const result: SaveGameResponse = await controller.saveGameFromSession(gameFromSession);

            expect(result).toEqual({
                success: false,
                message: `Erreur lors de la sauvegarde du jeu '${gameFromSession.name}': Mapping error`,
                error: 'Mapping error',
            });
        });

        it('should handle non-Error rejections with unknown error', async () => {
            const gameFromSession = {
                name: 'unknownErrorGame',
                gameData: {
                    id: '1',
                    name: 'Unknown Game',
                    description: 'Unknown description',
                    mode: Mode.Classic,
                    size: '10',
                    isVisible: true,
                    cells: [],
                },
            };
            const mockDto: CreateGameDto = {
                id: '1',
                name: 'Unknown Game',
                description: 'Unknown description',
                mode: Mode.Classic,
                size: '10',
                lastModified: '2026-01-25',
            };

            jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(mockDto);
            gameService.addGame.mockRejectedValue('Unknown');

            const result: SaveGameResponse = await controller.saveGameFromSession(gameFromSession);

            expect(result).toEqual({
                success: false,
                message: `Erreur lors de la sauvegarde du jeu '${gameFromSession.name}': ${UNKNOWN_ERROR}`,
                error: UNKNOWN_ERROR,
            });
        });

        it('should work with complete game data', async () => {
            // Arrange
            const gameFromSession = {
                name: 'complexGame',
                gameData: {
                    id: '1',
                    _id: '1',
                    name: 'Complex Game',
                    description: 'A complex test game',
                    mode: Mode.CTF,
                    size: '250MB',
                    lastModified: '2026-01-25',
                    imageURL: 'http://example.com/image.jpg',
                    isVisible: true,
                    cells: [],
                },
            };
            const expectedDto: CreateGameDto = {
                id: '1',
                name: 'Complex Game',
                description: 'A complex test game',
                mode: Mode.CTF,
                size: '250MB',
                lastModified: '2026-01-25',
            };

            jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(expectedDto);
            gameService.addGame.mockResolvedValue(undefined);

            // Act
            const result: SaveGameResponse = await controller.saveGameFromSession(gameFromSession);

            // Assert
            expect(gameService.addGame).toHaveBeenCalledWith(expectedDto);
            expect(result.success).toBe(true);
            expect(result.game).toEqual(expectedDto); // Expect the DTO
        });

        it('should handle minimal game data', async () => {
            // Arrange
            const gameFromSession = {
                name: 'minimalGame',
                gameData: {
                    id: '',
                    name: '',
                    description: '',
                    mode: '',
                    size: '',
                    isVisible: false,
                    cells: [],
                },
            };
            const minimalDto: CreateGameDto = {
                id: '',
                name: '',
                description: '',
                mode: '',
                size: '',
                lastModified: '2026-01-25',
            };

            jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(minimalDto);
            gameService.addGame.mockResolvedValue(undefined);

            // Act
            const result: SaveGameResponse = await controller.saveGameFromSession(gameFromSession);

            // Assert
            expect(CreateGameDtoMapper.toDto).toHaveBeenCalledWith(gameFromSession.gameData);
            expect(gameService.addGame).toHaveBeenCalledWith(minimalDto);
            expect(result.success).toBe(true);
            expect(result.game).toEqual(minimalDto);
        });
    });

    it('should work with complete game data', async () => {
        const expectedDto: CreateGameDto = mockGameDto;
        jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(expectedDto);
        gameService.addGame.mockResolvedValue(undefined);

        const result: SaveGameResponse = await controller.saveGameFromSession(baseGameFromSession);

        expect(gameService.addGame).toHaveBeenCalledWith(expectedDto);
        expect(result.success).toBe(true);
        expect(result.game).toEqual(expectedDto);
    });

    it('should handle minimal game data', async () => {
        const minimalDto: CreateGameDto = {
            id: '',
            name: '',
            description: '',
            mode: '',
            size: '',
            lastModified: '2026-01-25',
            cells: [],
        };

        jest.spyOn(CreateGameDtoMapper, 'toDto').mockReturnValue(minimalDto);
        gameService.addGame.mockResolvedValue(undefined);

        const result: SaveGameResponse = await controller.saveGameFromSession(baseGameFromSession);

        expect(CreateGameDtoMapper.toDto).toHaveBeenCalledWith(baseGameFromSession.gameData);
        expect(gameService.addGame).toHaveBeenCalledWith(minimalDto);
        expect(result.success).toBe(true);
        expect(result.game).toEqual(minimalDto);
    });
});

describe('GameService integration', () => {
    it('should properly inject GameService dependency', () => {
        expect(gameService).toBeDefined();
    });
});

describe('CreateGameDtoMapper integration', () => {
    it('should have access to CreateGameDtoMapper static methods', () => {
        expect(CreateGameDtoMapper).toBeDefined();
        expect(typeof CreateGameDtoMapper.toDto).toBe('function');
    });
});
