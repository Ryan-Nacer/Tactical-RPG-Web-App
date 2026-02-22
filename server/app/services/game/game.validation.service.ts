import { GameDocument, Games } from '@app/model/database/game';
import { GameCellDto } from '@app/model/dto/game/game-cell.dto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TileId, ObjectId, Mode as GameMode, isTerrainTile } from '@common/game';

import { VALIDATION_MESSAGES } from './game.validation.messages';

enum GridSize {
    Small = 10,
    Medium = 15,
    Large = 20,
}

enum StartPoints {
    Small = 2,
    Medium = 4,
    Large = 6,
}

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
        if (!name || !name.trim()) {
            return;
        }
        const nameWanted = name.trim();
        const nameRegex = this.buildNameRegex(nameWanted);
        const game = await this.gameModel.findOne({ name: { $regex: nameRegex } });

        if (game !== null) {
            throw new BadRequestException(VALIDATION_MESSAGES.name.alreadyUsed);
        }
    }

    async checkNameUniqueForUpdate(gameId: string, name: string | undefined): Promise<void> {
        if (!name || !name.trim()) {
            return;
        }
        const nameWanted = name.trim();
        const nameRegex = this.buildNameRegex(nameWanted);
        const game = await this.gameModel.findOne({ name: { $regex: nameRegex }, id: { $ne: gameId } });

        if (game !== null) {
            throw new BadRequestException(VALIDATION_MESSAGES.name.alreadyUsed);
        }
    }

    private buildNameRegex(name: string): RegExp {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^\\s*${escaped}\\s*$`, 'i');
    }

    private tileAtPosition(cells: GameCellDto[], row: number, column: number): TileId {
        const cell = cells.find((t) => t.row === row && t.column === column);
        return cell ? (cell.tile as TileId) : undefined;
    }

    private isDoorValid(cells: GameCellDto[], row: number, column: number): boolean {
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
        const size = typeof sizeValue === 'number' ? sizeValue : Number(sizeValue);
        let required: number | null = null;
        if (size === GridSize.Small) required = StartPoints.Small;
        if (size === GridSize.Medium) required = StartPoints.Medium;
        if (size === GridSize.Large) required = StartPoints.Large;
        if (required === null || Number.isNaN(size)) {
            throw new BadRequestException(VALIDATION_MESSAGES.grid.invalidSize);
        }

        const placed = cells.filter((c) => c.object === ObjectId.Start).length;
        if (placed !== required) {
            throw new BadRequestException(`${VALIDATION_MESSAGES.grid.invalidStartPoints}: ${placed}/${required}.`);
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
        const nonWallTileCount = cells.filter((c) => c.tile !== TileId.Wall).length;
        const startsList = cells.filter((c) => c.object === ObjectId.Start);
        if (startsList.length === 0) {
            return;
        }

        for (const start of startsList) {
            const visited: string[] = [];
            const queue: string[] = [];
            const startTile = `${start.row},${start.column}`;
            visited.push(startTile);
            queue.push(startTile);
            while (queue.length > 0) {
                const currentTile = queue.shift();
                if (currentTile === undefined) {
                    continue;
                }
                const parts = currentTile.split(',');
                const row = Number(parts[0]);
                const col = Number(parts[1]);
                const neighbors: number[][] = [
                    [row - 1, col],
                    [row + 1, col],
                    [row, col - 1],
                    [row, col + 1],
                ];
                for (const n of neighbors) {
                    const tile = this.tileAtPosition(cells, n[0], n[1]);
                    if (tile === undefined) {
                        continue;
                    }
                    if (tile === TileId.Wall) {
                        continue;
                    }
                    if (visited.includes(`${n[0]},${n[1]}`)) {
                        continue;
                    }
                    visited.push(`${n[0]},${n[1]}`);
                    queue.push(`${n[0]},${n[1]}`);
                }
            }
            if (visited.length !== nonWallTileCount) {
                throw new BadRequestException(VALIDATION_MESSAGES.terrain.inaccessible);
            }
        }
    }
}
