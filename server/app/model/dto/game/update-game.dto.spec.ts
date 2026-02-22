import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { GameCellDto } from '@app/model/dto/game/game-cell.dto';
import { TileId } from '@common/game';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('UpdateGameDto', () => {
    it('should validate an empty dto', async () => {
        const dto = new UpdateGameDto();

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
    });

    it('should validate dto with nested cells', async () => {
        const dtoInput = {
            cells: [{ row: 0, column: 1, tile: TileId.Base }],
        };

        const dto = plainToInstance(UpdateGameDto, dtoInput);
        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
        expect(dto.cells?.[0]).toBeInstanceOf(GameCellDto);
    });

    it('should fail when a cell has an invalid tile', async () => {
        const dtoInput = {
            cells: [{ row: 0, column: 1, tile: 'invalid' }],
        };

        const dto = plainToInstance(UpdateGameDto, dtoInput);
        const errors = await validate(dto);

        expect(errors.some((error) => error.property === 'cells')).toBe(true);
    });
});
