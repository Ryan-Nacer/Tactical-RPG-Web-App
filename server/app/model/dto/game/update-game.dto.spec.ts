import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { GameCellDto } from '@app/model/dto/game/game-cell.dto';
import { TileId } from '@common/game';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * Strategie :
 * - verifier qu'un patch vide reste autorise pour UpdateGameDto
 * - verifier que les cellules imbriquees sont bien transformees et validees
 *
 * Cas limites cibles :
 * - payload vide
 * - tuile invalide dans une cellule imbriquee
 *
 * Ces cas couvrent le contrat permissif d'une mise a jour partielle sans laisser passer
 * des valeurs de grille corrompues.
 */
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
