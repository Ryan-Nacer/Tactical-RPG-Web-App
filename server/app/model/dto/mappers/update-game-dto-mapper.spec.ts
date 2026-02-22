import { Games } from '@app/model/database/game';
import { GameCellDto } from '@app/model/dto/game/game-cell.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { UpdateGameDtoMapper } from '@app/model/dto/mappers/update-game-dto-mapper';
import { TileId, Mode } from '@common/game';

describe('UpdateGameDtoMapper', () => {
    const gameName = 'Test Game';
    const gameSize = '10';
    const gameDescription = 'Description';

    it('toModel should map dto to partial model', () => {
        const cell = new GameCellDto();
        cell.row = 1;
        cell.column = 0;
        cell.tile = TileId.Water;

        const dto = new UpdateGameDto();
        dto.name = gameName;
        dto.size = gameSize;
        dto.description = gameDescription;
        dto.mode = Mode.CTF;
        dto.isVisible = true;
        dto.cells = [cell];

        const model = UpdateGameDtoMapper.toModel(dto);

        expect(model.name).toBe(dto.name);
        expect(model.size).toBe(dto.size);
        expect(model.description).toBe(dto.description);
        expect(model.mode).toBe(dto.mode);
        expect(model.isVisible).toBe(dto.isVisible);
        expect(model.cells).toEqual(dto.cells);
    });

    it('toDto should default missing cells to empty array', () => {
        const game = {
            id: 'game-1',
            name: gameName,
            size: gameSize,
            description: gameDescription,
            mode: Mode.CTF,
            isVisible: false,
        } as Games;

        const dto = UpdateGameDtoMapper.toDto(game);

        expect(dto.cells).toEqual([]);
    });
});
