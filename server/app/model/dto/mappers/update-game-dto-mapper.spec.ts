import { Games } from '@app/model/database/game';
import { GameCellDto } from '@app/model/dto/game/game-cell.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { UpdateGameDtoMapper } from '@app/model/dto/mappers/update-game-dto-mapper';
import { TileId, Mode, GridSize } from '@common/game';

/**
 * Strategie :
 * - verifier que le mapper de mise a jour reste fidele aux champs fournis sans
 *   imposer de valeur par defaut destructive sur les mises a jour partielles
 * - verifier que les champs collection restent normalises, car ce sont eux qui
 *   cassent le plus facilement les PATCH quand ils deviennent `undefined`
 *
 * Cas limites cibles :
 * - mapping partiel avec cellules presentes : une mise a jour ne doit pas perdre
 *   les donnees explicitement envoyees par le client
 * - modele source sans cellules : la normalisation vers `[]` evite de disperser
 *   des checks `undefined` dans les couches suivantes
 *
 * Ces cas evitent les regressions silencieuses lors des mises a jour partielles de jeux.
 */
describe('UpdateGameDtoMapper', () => {
    const gameName = 'Test Game';
    const gameSize = GridSize.Small;
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
