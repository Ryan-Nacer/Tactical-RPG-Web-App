import { GameDocument } from '@app/model/database/game';
import { GameCellDto } from '@app/model/dto/game/game-cell.dto';
import { GameValidationService } from '@app/services/game/game.validation.service';
import { BadRequestException } from '@nestjs/common';
import { Model } from 'mongoose';
import { DoorState, GridSize, Mode, ObjectId, ShrinePart, TileId } from '@common/game';

/**
 * Strategie :
 * - isoler la logique de validation metier du reste du service de jeu
 * - verifier les cas valides nominaux pour eviter des faux positifs
 * - verifier des cas limites explicites qui devraient etre rejetes avant l'acces a la base
 *
 * Cas limites cibles :
 * - nom et description vides
 * - unicite du nom a la creation et a la mise a jour
 * - placements invalides de portes, points de depart et drapeau
 *
 * Ces cas sont critiques car ils representent les donnees minimales ou invalides que
 * le client peut envoyer, et qu'on veut bloquer le plus tot possible cote serveur.
 */
describe('GameValidationService', () => {
    let service: GameValidationService;
    let gameModel: { findOne: jest.Mock };
    const numericLargeGridSize = 20;
    const secondShrineOrigin = 3;

    /* eslint-disable max-params */
    const createCell = (
        row: number,
        column: number,
        tile: TileId,
        object?: ObjectId,
        doorState?: DoorState,
        shrineId?: string,
        shrinePart?: ShrinePart,
    ): GameCellDto => ({
        row,
        column,
        tile,
        object,
        doorState,
        shrineId,
        shrinePart,
    });
    /* eslint-enable max-params */

    const createShrineCells = (object: ObjectId.Heal | ObjectId.Combat, shrineId = 'shrine-1', originRow = 0, originColumn = 0): GameCellDto[] => [
        createCell(originRow, originColumn, TileId.Base, object, undefined, shrineId, ShrinePart.TopLeft),
        createCell(originRow, originColumn + 1, TileId.Base, object, undefined, shrineId, ShrinePart.TopRight),
        createCell(originRow + 1, originColumn, TileId.Base, object, undefined, shrineId, ShrinePart.BottomLeft),
        createCell(originRow + 1, originColumn + 1, TileId.Base, object, undefined, shrineId, ShrinePart.BottomRight),
    ];

    beforeEach(() => {
        gameModel = { findOne: jest.fn() };
        service = new GameValidationService(gameModel as unknown as Model<GameDocument>);
    });

    it('checkNameRequired should throw for empty name', () => {
        expect(() => service.checkNameRequired('')).toThrow(BadRequestException);
    });

    it('checkNameRequired should accept a valid name', () => {
        expect(() => service.checkNameRequired('  Valid  ')).not.toThrow();
    });

    it('checkDescriptionRequired should throw for empty description', () => {
        expect(() => service.checkDescriptionRequired('')).toThrow(BadRequestException);
    });

    it('checkDescriptionRequired should accept a valid description', () => {
        expect(() => service.checkDescriptionRequired('  Description  ')).not.toThrow();
    });

    it('checkNameUniqueForCreate should return when name is empty', async () => {
        await service.checkNameUniqueForCreate('');
        expect(gameModel.findOne).not.toHaveBeenCalled();
    });

    it('checkNameUniqueForCreate should accept a unique name', async () => {
        gameModel.findOne.mockResolvedValue(null);

        await expect(service.checkNameUniqueForCreate('Test Game')).resolves.toBeUndefined();
        expect(gameModel.findOne).toHaveBeenCalled();
    });

    it('checkNameUniqueForCreate should throw when name already exists', async () => {
        gameModel.findOne.mockResolvedValue({ id: 'game-1' });

        await expect(service.checkNameUniqueForCreate('Test Game')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('checkNameUniqueForUpdate should throw when name already exists', async () => {
        gameModel.findOne.mockResolvedValue({ id: 'game-2' });

        await expect(service.checkNameUniqueForUpdate('game-1', 'Test Game')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('checkNameUniqueForUpdate should return when name is empty', async () => {
        await service.checkNameUniqueForUpdate('game-1', '  ');
        expect(gameModel.findOne).not.toHaveBeenCalled();
    });

    it('checkNameUniqueForUpdate should accept a unique name', async () => {
        gameModel.findOne.mockResolvedValue(null);

        await expect(service.checkNameUniqueForUpdate('game-1', 'Test Game')).resolves.toBeUndefined();
        expect(gameModel.findOne).toHaveBeenCalled();
    });

    it('checkDoors should accept valid door placement', () => {
        const cells = [
            createCell(1, 1, TileId.Door, undefined, DoorState.Closed),
            createCell(1, 0, TileId.Wall),
            createCell(1, 2, TileId.Wall),
            createCell(0, 1, TileId.Base),
            createCell(2, 1, TileId.Base),
        ];

        expect(() => service.checkDoors(cells)).not.toThrow();
    });

    it('checkDoors should accept valid door placement with walls up/down', () => {
        const cells = [
            createCell(1, 1, TileId.Door, undefined, DoorState.Open),
            createCell(1, 0, TileId.Base),
            createCell(1, 2, TileId.Base),
            createCell(0, 1, TileId.Wall),
            createCell(2, 1, TileId.Wall),
        ];

        expect(() => service.checkDoors(cells)).not.toThrow();
    });

    it('checkDoors should throw for invalid door placement', () => {
        const cells = [
            createCell(1, 1, TileId.Door, undefined, DoorState.Closed),
            createCell(1, 0, TileId.Base),
            createCell(1, 2, TileId.Base),
            createCell(0, 1, TileId.Base),
            createCell(2, 1, TileId.Base),
        ];

        expect(() => service.checkDoors(cells)).toThrow(BadRequestException);
    });

    it('checkDoors should throw when a door is placed on the border', () => {
        const cells = [
            createCell(0, 1, TileId.Door, undefined, DoorState.Open),
            createCell(0, 0, TileId.Wall),
            createCell(0, 2, TileId.Wall),
            createCell(1, 1, TileId.Base),
            createCell(1, 0, TileId.Base),
            createCell(1, 2, TileId.Base),
        ];

        expect(() => service.checkDoors(cells)).toThrow(BadRequestException);
    });

    it('checkDoors should keep accepting doors without doorState for backward compatibility', () => {
        const cells = [
            createCell(1, 1, TileId.Door),
            createCell(1, 0, TileId.Wall),
            createCell(1, 2, TileId.Wall),
            createCell(0, 1, TileId.Base),
            createCell(2, 1, TileId.Base),
        ];

        expect(() => service.checkDoors(cells)).not.toThrow();
    });

    it('checkTerrainCoverage should throw for empty grid', () => {
        expect(() => service.checkTerrainCoverage([])).toThrow(BadRequestException);
    });

    it('checkTerrainCoverage should throw when terrain coverage is insufficient', () => {
        const cells = [createCell(0, 0, TileId.Base), createCell(0, 1, TileId.Wall), createCell(1, 0, TileId.Wall), createCell(1, 1, TileId.Base)];

        expect(() => service.checkTerrainCoverage(cells)).toThrow(BadRequestException);
    });

    it('checkTerrainCoverage should accept valid terrain coverage', () => {
        const cells = [createCell(0, 0, TileId.Base), createCell(0, 1, TileId.Base), createCell(1, 0, TileId.Base), createCell(1, 1, TileId.Wall)];

        expect(() => service.checkTerrainCoverage(cells)).not.toThrow();
    });

    it('checkStartPoints should throw for invalid size', () => {
        const cells = [createCell(0, 0, TileId.Base, ObjectId.Start)];

        expect(() => service.checkStartPoints(cells, 'invalid')).toThrow(BadRequestException);
    });

    it('checkStartPoints should accept valid start points for small grid', () => {
        const cells = [createCell(0, 0, TileId.Base, ObjectId.Start), createCell(0, 1, TileId.Base, ObjectId.Start)];

        expect(() => service.checkStartPoints(cells, '10')).not.toThrow();
    });

    it('checkStartPoints should accept valid start points for medium grid', () => {
        const cells = [
            createCell(0, 0, TileId.Base, ObjectId.Start),
            createCell(0, 1, TileId.Base, ObjectId.Start),
            createCell(1, 0, TileId.Base, ObjectId.Start),
            createCell(1, 1, TileId.Base, ObjectId.Start),
        ];

        expect(() => service.checkStartPoints(cells, '15')).not.toThrow();
    });

    it('checkStartPoints should accept valid start points for large grid when size is a number', () => {
        const cells = [
            createCell(0, 0, TileId.Base, ObjectId.Start),
            createCell(0, 1, TileId.Base, ObjectId.Start),
            createCell(1, 0, TileId.Base, ObjectId.Start),
            createCell(1, 1, TileId.Base, ObjectId.Start),
            createCell(2, 0, TileId.Base, ObjectId.Start),
            createCell(2, 1, TileId.Base, ObjectId.Start),
        ];

        expect(() => service.checkStartPoints(cells, numericLargeGridSize)).not.toThrow();
    });

    it('checkStartPoints should throw when start points count is invalid', () => {
        const cells = [createCell(0, 0, TileId.Base, ObjectId.Start)];

        expect(() => service.checkStartPoints(cells, '10')).toThrow(BadRequestException);
    });

    it('checkFlagPlacement should throw when CTF has no flag', () => {
        const cells = [createCell(0, 0, TileId.Base)];

        expect(() => service.checkFlagPlacement(cells, Mode.CTF)).toThrow(BadRequestException);
    });

    it('checkFlagPlacement should throw when Classic has a flag', () => {
        const cells = [createCell(0, 0, TileId.Base, ObjectId.Flag)];

        expect(() => service.checkFlagPlacement(cells, Mode.Classic)).toThrow(BadRequestException);
    });

    it('checkFlagPlacement should accept CTF with one flag', () => {
        const cells = [createCell(0, 0, TileId.Base, ObjectId.Flag)];

        expect(() => service.checkFlagPlacement(cells, Mode.CTF)).not.toThrow();
    });

    it('checkFlagPlacement should accept non-CTF with no flags', () => {
        const cells = [createCell(0, 0, TileId.Base)];

        expect(() => service.checkFlagPlacement(cells, undefined)).not.toThrow();
    });

    it('checkShrines should accept a valid 2x2 shrine', () => {
        const cells = createShrineCells(ObjectId.Heal);

        expect(() => service.checkShrines(cells, GridSize.Small)).not.toThrow();
    });

    it('checkShrines should throw when shrine metadata is incomplete', () => {
        const cells = [createCell(0, 0, TileId.Base, ObjectId.Heal)];

        expect(() => service.checkShrines(cells, GridSize.Small)).toThrow(BadRequestException);
    });

    it('checkShrines should throw when a shrine does not form a 2x2 block', () => {
        const cells = createShrineCells(ObjectId.Combat);
        cells[3] = createCell(2, 2, TileId.Base, ObjectId.Combat, undefined, 'shrine-1', ShrinePart.BottomRight);

        expect(() => service.checkShrines(cells, GridSize.Small)).toThrow(BadRequestException);
    });

    it('checkShrines should throw when a shrine cell is on a non-terrain tile', () => {
        const cells = createShrineCells(ObjectId.Heal);
        cells[0] = createCell(0, 0, TileId.Wall, ObjectId.Heal, undefined, 'shrine-1', ShrinePart.TopLeft);

        expect(() => service.checkShrines(cells, GridSize.Small)).toThrow(BadRequestException);
    });

    it('checkShrines should throw when shrine metadata appears on a non-shrine object', () => {
        const cells = [createCell(0, 0, TileId.Base, ObjectId.Start, undefined, 'shrine-1', ShrinePart.TopLeft)];

        expect(() => service.checkShrines(cells, GridSize.Small)).toThrow(BadRequestException);
    });

    it('checkShrines should enforce the shared shrine limit by grid size', () => {
        const cells = [
            ...createShrineCells(ObjectId.Heal, 'shrine-1', 0, 0),
            ...createShrineCells(ObjectId.Combat, 'shrine-2', secondShrineOrigin, secondShrineOrigin),
        ];

        expect(() => service.checkShrines(cells, GridSize.Small)).toThrow(BadRequestException);
    });

    it('hasInaccessibleTiles should return when there is no start point', () => {
        const cells = [createCell(0, 0, TileId.Base)];

        expect(() => service.hasInaccessibleTiles(cells)).not.toThrow();
    });

    it('hasInaccessibleTiles should ignore undefined queue items', () => {
        const cells = [createCell(0, 0, TileId.Base, ObjectId.Start)];
        const originalShift = Array.prototype.shift;
        let isFirstCall = true;
        const shiftSpy = jest.spyOn(Array.prototype, 'shift').mockImplementation(function (this: unknown[]) {
            const value = originalShift.call(this);
            if (isFirstCall) {
                isFirstCall = false;
                return undefined;
            }
            return value;
        });

        try {
            expect(() => service.hasInaccessibleTiles(cells)).not.toThrow();
        } finally {
            shiftSpy.mockRestore();
        }
    });

    it('hasInaccessibleTiles should throw when tiles are inaccessible', () => {
        const cells = [createCell(0, 0, TileId.Base, ObjectId.Start), createCell(0, 1, TileId.Wall), createCell(0, 2, TileId.Base)];

        expect(() => service.hasInaccessibleTiles(cells)).toThrow(BadRequestException);
    });

    it('hasInaccessibleTiles should treat shrine cells as walls for map accessibility', () => {
        const cells = [
            createCell(0, 0, TileId.Base, ObjectId.Start),
            createCell(1, 0, TileId.Base),
            ...createShrineCells(ObjectId.Heal, 'shrine-1', 0, 1),
            createCell(0, secondShrineOrigin, TileId.Base),
        ];

        expect(() => service.hasInaccessibleTiles(cells)).toThrow(BadRequestException);
    });

    it('hasInaccessibleTiles should throw when a shrine has no reachable adjacent tile', () => {
        const cells = [
            createCell(secondShrineOrigin, secondShrineOrigin, TileId.Base, ObjectId.Start),
            createCell(secondShrineOrigin, 2, TileId.Base),
            ...createShrineCells(ObjectId.Combat, 'shrine-1', 0, 0),
        ];

        expect(() => service.hasInaccessibleTiles(cells)).toThrow(BadRequestException);
    });

    it('hasInaccessibleTiles should accept accessible tiles', () => {
        const cells = [createCell(0, 0, TileId.Base, ObjectId.Start), createCell(0, 1, TileId.Base)];

        expect(() => service.hasInaccessibleTiles(cells)).not.toThrow();
    });
});
