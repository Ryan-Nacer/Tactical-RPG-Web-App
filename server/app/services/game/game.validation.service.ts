import { GameDocument, Games } from '@app/model/database/game';
import { GameCellDto } from '@app/model/dto/game/game-cell.dto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CARDINAL_NEIGHBOR_OFFSETS, GridSize, Mode as GameMode, ObjectId, TileId, isTerrainTile, ShrinePart } from '@common/game';
import { VALIDATION_MESSAGES } from './game.validation.messages';

enum StartPoints {
    Small = 2,
    Medium = 4,
    Large = 6,
}

const SHRINE_LIMIT_BY_GRID_SIZE = {
    [GridSize.Small]: 1,
    [GridSize.Medium]: 2,
    [GridSize.Large]: 4,
} as const;
const SHRINE_CELL_COUNT = 4;

@Injectable()
export class GameValidationService {
    constructor(@InjectModel(Games.name) private readonly gameModel: Model<GameDocument>) {}

    checkNameRequired(name: string | undefined): void {
        if (!name || !name.trim()) {
            throw new BadRequestException(VALIDATION_MESSAGES.name.required);
        }
    }

    checkDescriptionRequired(description: string | undefined): void {
        if (!description || !description.trim()) {
            throw new BadRequestException(VALIDATION_MESSAGES.description.required);
        }
    }

    async checkNameUniqueForCreate(name: string | undefined): Promise<void> {
        await this.checkNameUnique(name);
    }

    async checkNameUniqueForUpdate(gameId: string, name: string | undefined): Promise<void> {
        await this.checkNameUnique(name, gameId);
    }

    private async checkNameUnique(name: string | undefined, excludedGameId?: string): Promise<void> {
        if (!name || !name.trim()) {
            return;
        }

        const nameWanted = name.trim();
        const nameRegex = this.buildNameRegex(nameWanted);
        const query = excludedGameId === undefined ? { name: { $regex: nameRegex } } : { name: { $regex: nameRegex }, id: { $ne: excludedGameId } };
        const game = await this.gameModel.findOne(query);

        if (game) {
            throw new BadRequestException(VALIDATION_MESSAGES.name.alreadyUsed);
        }
    }

    private buildNameRegex(name: string): RegExp {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^\\s*${escaped}\\s*$`, 'i');
    }

    private tileAtPosition(cells: GameCellDto[], row: number, column: number): TileId | undefined {
        const cell = cells.find((t) => t.row === row && t.column === column);
        return cell ? (cell.tile as TileId) : undefined;
    }

    private cellAtPosition(cells: GameCellDto[], row: number, column: number): GameCellDto | undefined {
        return cells.find((cell) => cell.row === row && cell.column === column);
    }

    private isBorderPosition(cells: GameCellDto[], row: number, column: number): boolean {
        const rows = cells.map((cell) => cell.row);
        const columns = cells.map((cell) => cell.column);
        const minRow = Math.min(...rows);
        const maxRow = Math.max(...rows);
        const minColumn = Math.min(...columns);
        const maxColumn = Math.max(...columns);

        return row === minRow || row === maxRow || column === minColumn || column === maxColumn;
    }

    private isDoorValid(cells: GameCellDto[], row: number, column: number): boolean {
        if (this.isBorderPosition(cells, row, column)) {
            return false;
        }

        const left = this.tileAtPosition(cells, row, column - 1);
        const right = this.tileAtPosition(cells, row, column + 1);
        const up = this.tileAtPosition(cells, row - 1, column);
        const down = this.tileAtPosition(cells, row + 1, column);

        if (left === TileId.Wall && right === TileId.Wall && isTerrainTile(up) && isTerrainTile(down)) {
            return true;
        }
        if (isTerrainTile(left) && isTerrainTile(right) && up === TileId.Wall && down === TileId.Wall) {
            return true;
        }
        return false;
    }

    checkDoors(cells: GameCellDto[]): void {
        const doors = cells.filter((c) => c.tile === TileId.Door);
        if (!doors.every((d) => this.isDoorValid(cells, d.row, d.column))) {
            throw new BadRequestException(VALIDATION_MESSAGES.door.invalidPlacement);
        }
    }

    checkTerrainCoverage(cells: GameCellDto[]): void {
        const totalTileCount = cells.length;
        if (totalTileCount === 0) {
            throw new BadRequestException(VALIDATION_MESSAGES.grid.empty);
        }

        const terrainTileCount = cells.filter((c) => isTerrainTile(c.tile as TileId)).length;
        if (terrainTileCount <= totalTileCount / 2) {
            throw new BadRequestException(VALIDATION_MESSAGES.terrain.invalidCoverage);
        }
    }

    checkStartPoints(cells: GameCellDto[], sizeValue: string | number | undefined): void {
        const size = this.resolveGridSize(sizeValue);
        let required: number | null = null;
        if (size === GridSize.Small) required = StartPoints.Small;
        if (size === GridSize.Medium) required = StartPoints.Medium;
        if (size === GridSize.Large) required = StartPoints.Large;

        const placed = cells.filter((c) => c.object === ObjectId.Start).length;
        if (placed !== required) {
            throw new BadRequestException(`${VALIDATION_MESSAGES.grid.invalidStartPoints}: ${placed}/${required}.`);
        }
    }

    checkShrines(cells: GameCellDto[], sizeValue: string | number | undefined): void {
        const size = this.resolveGridSize(sizeValue);
        const shrineGroups = new Map<string, GameCellDto[]>();

        for (const cell of cells) {
            const hasShrineMetadata = cell.shrineId !== undefined || cell.shrinePart !== undefined || cell.shrineCooldownTurns !== undefined;
            if (!this.isShrineObject(cell.object)) {
                if (hasShrineMetadata) {
                    throw new BadRequestException(VALIDATION_MESSAGES.shrine.invalidPlacement);
                }
                continue;
            }

            if (!cell.shrineId || !cell.shrinePart || !isTerrainTile(cell.tile)) {
                throw new BadRequestException(VALIDATION_MESSAGES.shrine.invalidPlacement);
            }

            const shrineCells = shrineGroups.get(cell.shrineId) ?? [];
            shrineCells.push(cell);
            shrineGroups.set(cell.shrineId, shrineCells);
        }

        const shrineLimit = SHRINE_LIMIT_BY_GRID_SIZE[size];
        if (shrineGroups.size > shrineLimit) {
            throw new BadRequestException(`${VALIDATION_MESSAGES.shrine.invalidLimit}: ${shrineGroups.size}/${shrineLimit}.`);
        }

        for (const shrineCells of shrineGroups.values()) {
            this.validateShrineGroup(shrineCells);
        }
    }

    checkFlagPlacement(cells: GameCellDto[], modeValue: string | undefined): void {
        const flagCount = cells.filter((c) => c.object === ObjectId.Flag).length;
        if (modeValue === GameMode.CTF) {
            if (flagCount !== 1) {
                throw new BadRequestException(`${VALIDATION_MESSAGES.flag.invalidCtf}: ${flagCount}/1.`);
            }
            return;
        }
        if (flagCount > 0) {
            throw new BadRequestException(`${VALIDATION_MESSAGES.flag.invalidClassic} ${GameMode.Classic}.`);
        }
    }

    hasInaccessibleTiles(cells: GameCellDto[]): void {
        const traversableTileCount = cells.filter((cell) => this.isTraversableForAccessibility(cell)).length;
        const startsList = cells.filter((c) => c.object === ObjectId.Start);
        if (startsList.length === 0) {
            return;
        }

        const shrineGroups = this.groupShrineCells(cells);
        for (const start of startsList) {
            const visited = this.computeAccessibleTileKeys(cells, start);
            if (visited.size !== traversableTileCount) {
                throw new BadRequestException(VALIDATION_MESSAGES.terrain.inaccessible);
            }
            if (!this.areShrinesAccessible(shrineGroups, visited)) {
                throw new BadRequestException(VALIDATION_MESSAGES.shrine.inaccessible);
            }
        }
    }

    private computeAccessibleTileKeys(cells: GameCellDto[], start: GameCellDto): Set<string> {
        const visited = new Set<string>();
        const queue: string[] = [];
        const startTile = `${start.row},${start.column}`;
        visited.add(startTile);
        queue.push(startTile);
        while (queue.length > 0) {
            const currentTile = queue.shift();
            if (currentTile === undefined) {
                continue;
            }
            const parts = currentTile.split(',');
            const row = Number(parts[0]);
            const col = Number(parts[1]);
            const neighbors = CARDINAL_NEIGHBOR_OFFSETS.map((offset) => [row + offset.row, col + offset.column]);
            for (const n of neighbors) {
                const cell = this.cellAtPosition(cells, n[0], n[1]);
                if (!this.isTraversableForAccessibility(cell)) {
                    continue;
                }
                const neighborKey = `${n[0]},${n[1]}`;
                if (visited.has(neighborKey)) {
                    continue;
                }
                visited.add(neighborKey);
                queue.push(neighborKey);
            }
        }
        return visited;
    }

    private isTraversableForAccessibility(cell: GameCellDto | undefined): boolean {
        return !!cell && cell.tile !== TileId.Wall && !this.isShrineObject(cell.object);
    }

    private groupShrineCells(cells: GameCellDto[]): Map<string, GameCellDto[]> {
        const shrineGroups = new Map<string, GameCellDto[]>();

        for (const cell of cells) {
            if (!this.isShrineObject(cell.object)) {
                continue;
            }

            const shrineKey = cell.shrineId ?? `legacy-${cell.row}-${cell.column}`;
            const shrineCells = shrineGroups.get(shrineKey) ?? [];
            shrineCells.push(cell);
            shrineGroups.set(shrineKey, shrineCells);
        }

        return shrineGroups;
    }

    private areShrinesAccessible(shrineGroups: Map<string, GameCellDto[]>, visited: Set<string>): boolean {
        for (const shrineCells of shrineGroups.values()) {
            if (!this.hasReachableAdjacentCell(shrineCells, visited)) {
                return false;
            }
        }

        return true;
    }

    private hasReachableAdjacentCell(shrineCells: GameCellDto[], visited: Set<string>): boolean {
        const shrineKeys = new Set(shrineCells.map((cell) => `${cell.row},${cell.column}`));

        for (const cell of shrineCells) {
            const adjacentPositions = [
                `${cell.row - 1},${cell.column}`,
                `${cell.row + 1},${cell.column}`,
                `${cell.row},${cell.column - 1}`,
                `${cell.row},${cell.column + 1}`,
            ];

            if (adjacentPositions.some((position) => !shrineKeys.has(position) && visited.has(position))) {
                return true;
            }
        }

        return false;
    }

    private resolveGridSize(sizeValue: string | number | undefined): GridSize {
        const size = typeof sizeValue === 'number' ? sizeValue : Number(sizeValue);
        if (size !== GridSize.Small && size !== GridSize.Medium && size !== GridSize.Large) {
            throw new BadRequestException(VALIDATION_MESSAGES.grid.invalidSize);
        }
        return size;
    }

    private isShrineObject(object?: ObjectId): object is ObjectId.Heal | ObjectId.Combat {
        return object === ObjectId.Heal || object === ObjectId.Combat;
    }

    private validateShrineGroup(shrineCells: GameCellDto[]): void {
        if (shrineCells.length !== SHRINE_CELL_COUNT) {
            throw new BadRequestException(VALIDATION_MESSAGES.shrine.invalidPlacement);
        }

        const topLeft = shrineCells.find((cell) => cell.shrinePart === ShrinePart.TopLeft);
        const topRight = shrineCells.find((cell) => cell.shrinePart === ShrinePart.TopRight);
        const bottomLeft = shrineCells.find((cell) => cell.shrinePart === ShrinePart.BottomLeft);
        const bottomRight = shrineCells.find((cell) => cell.shrinePart === ShrinePart.BottomRight);

        if (!topLeft || !topRight || !bottomLeft || !bottomRight) {
            throw new BadRequestException(VALIDATION_MESSAGES.shrine.invalidPlacement);
        }

        if (
            shrineCells.some((cell) => cell.object !== topLeft.object || !cell.shrineId || !cell.shrinePart || !isTerrainTile(cell.tile)) ||
            topRight.row !== topLeft.row ||
            topRight.column !== topLeft.column + 1 ||
            bottomLeft.row !== topLeft.row + 1 ||
            bottomLeft.column !== topLeft.column ||
            bottomRight.row !== topLeft.row + 1 ||
            bottomRight.column !== topLeft.column + 1
        ) {
            throw new BadRequestException(VALIDATION_MESSAGES.shrine.invalidPlacement);
        }
    }
}
