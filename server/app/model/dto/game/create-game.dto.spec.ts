import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { GameCellDto } from '@app/model/dto/game/game-cell.dto';
import { GAME_NAME_MAX_LENGTH } from '@app/model/dto/game/game.dto.constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TileId, Mode } from '@common/game';

describe('CreateGameDto', () => {
    const gameId = 'game-1';
    const gameName = 'Test Game';
    const gameSize = '10';
    const gameDescription = 'Description';

    it('should validate a complete dto with nested cells', async () => {
        const dtoInput = {
            id: gameId,
            name: gameName,
            size: gameSize,
            description: gameDescription,
            mode: Mode.Classic,
            cells: [{ row: 0, column: 1, tile: TileId.Base }],
        };

        const dto = plainToInstance(CreateGameDto, dtoInput);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.cells?.[0]).toBeInstanceOf(GameCellDto);
    });

    it('should fail when size is missing', async () => {
        const dto = new CreateGameDto();
        dto.name = gameName;
        dto.description = gameDescription;
        dto.mode = Mode.Classic;

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'size')).toBe(true);
    });

    it('should fail when name exceeds max length', async () => {
        const overMaxLength = GAME_NAME_MAX_LENGTH + 1;
        const dto = new CreateGameDto();
        dto.name = 'a'.repeat(overMaxLength);
        dto.size = gameSize;
        dto.description = gameDescription;
        dto.mode = Mode.Classic;

        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'name')).toBe(true);
    });

    it('should fail when a cell has an invalid tile', async () => {
        const dtoInput = {
            id: gameId,
            name: gameName,
            size: gameSize,
            description: gameDescription,
            mode: Mode.Classic,
            cells: [{ row: 0, column: 1, tile: 'tile:invalid' }],
        };

        const dto = plainToInstance(CreateGameDto, dtoInput);
        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'cells')).toBe(true);
    });
});
