import { Games } from '@app/model/database/game';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameCellDto } from '@app/model/dto/game/game-cell.dto';
import { CreateGameDtoMapper } from '@app/model/dto/mappers/create-game-dto-mapper';
import { TileId, Mode } from '@common/game';

describe('CreateGameDtoMapper', () => {
    const gameId = 'game-1';
    const gameName = 'Test Game';
    const gameSize = '10';
    const gameDescription = 'Description';

    it('toModel should map dto to model and force visibility true', () => {
        const cell = new GameCellDto();
        cell.row = 0;
        cell.column = 1;
        cell.tile = TileId.Base;

        const dto = new CreateGameDto();
        dto.id = gameId;
        dto.name = gameName;
        dto.size = gameSize;
        dto.description = gameDescription;
        dto.mode = Mode.Classic;
        dto.isVisible = false;
        dto.cells = [cell];

        const model = CreateGameDtoMapper.toModel(dto);

        expect(model.id).toBe(dto.id);
        expect(model.name).toBe(dto.name);
        expect(model.size).toBe(dto.size);
        expect(model.mode).toBe(dto.mode);
        expect(model.description).toBe(dto.description);
        expect(model.cells).toEqual(dto.cells);
        expect(model.isVisible).toBe(true);
    });

    it('toDto should default missing cells to empty array', () => {
        const game = {
            id: gameId,
            name: gameName,
            size: gameSize,
            description: gameDescription,
            mode: Mode.Classic,
            isVisible: true,
        } as Games;

        const dto = CreateGameDtoMapper.toDto(game);

        expect(dto.cells).toEqual([]);
    });

    it('toModel should default missing cells to empty array', () => {
        const dto = new CreateGameDto();
        dto.id = gameId;
        dto.name = gameName;
        dto.size = gameSize;
        dto.description = gameDescription;
        dto.mode = Mode.Classic;
        dto.cells = undefined;

        const model = CreateGameDtoMapper.toModel(dto);

        expect(model.cells).toEqual([]);
    });

    it('toModel should map imageURL and lastModified', () => {
        const dto = new CreateGameDto();
        dto.id = gameId;
        dto.name = gameName;
        dto.size = gameSize;
        dto.description = gameDescription;
        dto.mode = Mode.Classic;
        dto.imageURL = 'http://example.com/image.png';
        dto.lastModified = '2024-01-01T00:00:00Z';
        dto.cells = [];

        const model = CreateGameDtoMapper.toModel(dto);

        expect(model.imageURL).toBe(dto.imageURL);
        expect(model.lastModified).toBe(dto.lastModified);
    });

    it('toDto should map imageURL and lastModified and keep cells', () => {
        const cell = new GameCellDto();
        cell.row = 0;
        cell.column = 0;
        cell.tile = TileId.Base;

        const game = {
            id: gameId,
            name: gameName,
            size: gameSize,
            description: gameDescription,
            mode: Mode.Classic,
            isVisible: true,
            imageURL: 'http://example.com/image.png',
            lastModified: '2024-01-01T00:00:00Z',
            cells: [cell],
        } as Games;

        const dto = CreateGameDtoMapper.toDto(game);

        expect(dto.imageURL).toBe(game.imageURL);
        expect(dto.lastModified).toBe(game.lastModified);
        expect(dto.cells).toEqual(game.cells);
    });
});
