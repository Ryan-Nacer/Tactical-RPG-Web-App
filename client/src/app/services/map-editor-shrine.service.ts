import { Injectable } from '@angular/core';
import { GameGridCell } from '@app/interfaces/game';
import { GridSize, ObjectId, ShrinePart, Tool, isTerrainTile } from '@common/game';

type ShrineCoordinates = Pick<GameGridCell, 'row' | 'column'>;

export interface ShrinePlacementEvaluation {
    cells: ShrineCoordinates[];
    isValid: boolean;
    reason: string;
    object: ObjectId.Heal | ObjectId.Combat;
}

const SHRINE_LIMIT_BY_GRID_SIZE = {
    [GridSize.Small]: 1,
    [GridSize.Medium]: 2,
    [GridSize.Large]: 4,
} as const;

@Injectable({
    providedIn: 'root',
})
export class MapEditorShrineService {
    isShrineTool(tool: Tool): tool is ObjectId.Heal | ObjectId.Combat {
        return tool === ObjectId.Heal || tool === ObjectId.Combat;
    }

    getPreviewImageSrc(object: ObjectId.Heal | ObjectId.Combat): string {
        return object === ObjectId.Heal ? 'assets/objects/health.png' : 'assets/objects/combat.png';
    }

    computeRemainingShrines(cells: GameGridCell[], size: GridSize): number {
        return Math.max(0, this.computeShrineLimit(size) - this.countPlacedShrines(cells));
    }

    evaluatePlacement(
        cells: GameGridCell[],
        size: GridSize,
        origin: ShrineCoordinates,
        object: ObjectId.Heal | ObjectId.Combat,
        remainingCount: number,
    ): ShrinePlacementEvaluation {
        const shrineCells = this.getPlacementCells(origin);
        if (remainingCount === 0) {
            return {
                cells: shrineCells,
                isValid: false,
                reason: 'Limite de sanctuaires atteinte pour cette carte.',
                object,
            };
        }

        if (shrineCells.some((cell) => cell.row < 0 || cell.column < 0 || cell.row >= size || cell.column >= size)) {
            return {
                cells: shrineCells.filter((cell) => cell.row >= 0 && cell.column >= 0 && cell.row < size && cell.column < size),
                isValid: false,
                reason: 'Le sanctuaire doit tenir entierement sur une zone 2x2.',
                object,
            };
        }

        if (this.canPlaceShrine(cells, size, shrineCells)) {
            return {
                cells: shrineCells,
                isValid: true,
                reason: 'Placement valide du sanctuaire 2x2.',
                object,
            };
        }

        return {
            cells: shrineCells,
            isValid: false,
            reason: 'Les 4 cases doivent etre des tuiles de terrain libres.',
            object,
        };
    }

    placeShrine(
        cells: GameGridCell[],
        size: GridSize,
        placement: ShrineCoordinates[],
        object: ObjectId.Heal | ObjectId.Combat,
        shrineId: string,
    ): GameGridCell[] {
        const nextCells = [...cells];
        const parts: ShrinePart[] = [ShrinePart.TopLeft, ShrinePart.TopRight, ShrinePart.BottomLeft, ShrinePart.BottomRight];

        placement.forEach((cell, index) => {
            const cellIndex = this.getCellIndex(size, cell);
            nextCells[cellIndex] = {
                ...nextCells[cellIndex],
                object,
                shrineId,
                shrinePart: parts[index],
                shrineCooldownTurns: 0,
                doorState: undefined,
            };
        });

        return nextCells;
    }

    clearShrine(cells: GameGridCell[], shrineId: string): GameGridCell[] {
        return cells.map((cell) =>
            cell.shrineId === shrineId
                ? {
                      ...cell,
                      object: undefined,
                      shrineId: undefined,
                      shrinePart: undefined,
                      shrineCooldownTurns: undefined,
                  }
                : cell,
        );
    }

    private computeShrineLimit(size: GridSize): number {
        return SHRINE_LIMIT_BY_GRID_SIZE[size] ?? 0;
    }

    private countPlacedShrines(cells: GameGridCell[]): number {
        const shrineKeys = new Set<string>();

        for (const cell of cells) {
            if (cell.object !== ObjectId.Heal && cell.object !== ObjectId.Combat) {
                continue;
            }

            shrineKeys.add(cell.shrineId ?? `legacy-${cell.row}-${cell.column}`);
        }

        return shrineKeys.size;
    }

    private getPlacementCells(origin: ShrineCoordinates): ShrineCoordinates[] {
        return [
            { row: origin.row, column: origin.column },
            { row: origin.row, column: origin.column + 1 },
            { row: origin.row + 1, column: origin.column },
            { row: origin.row + 1, column: origin.column + 1 },
        ];
    }

    private canPlaceShrine(cells: GameGridCell[], size: GridSize, placement: ShrineCoordinates[]): boolean {
        return placement.every((cell) => {
            if (cell.row < 0 || cell.column < 0 || cell.row >= size || cell.column >= size) {
                return false;
            }

            const currentCell = cells[this.getCellIndex(size, cell)];
            return !!currentCell && isTerrainTile(currentCell.tile) && !currentCell.object && !currentCell.shrineId;
        });
    }

    private getCellIndex(size: GridSize, cell: ShrineCoordinates): number {
        return cell.column + size * cell.row;
    }
}
