import { GRID_SIZE_TO_PLAYER_COUNT_MAP } from '@app/pages/pages.constants';
import { GameGridCell } from '@app/interfaces/game';
import { Game, GridSize, Mode } from '@common/game';

type CellCoordinates = Pick<GameGridCell, 'row' | 'column'>;

export function computeStartLimit(size: GridSize): number {
    return GRID_SIZE_TO_PLAYER_COUNT_MAP[size];
}

export function computeRemainingStart(cells: GameGridCell[], size: GridSize): number {
    const placedStarts = cells.filter((cell) => cell.object === 'start').length;
    return Math.max(0, computeStartLimit(size) - placedStarts);
}

export function computeRemainingFlag(cells: GameGridCell[], mode: Mode): number {
    if (mode !== Mode.CTF) {
        return 0;
    }

    const placedFlags = cells.filter((cell) => cell.object === 'flag').length;
    return Math.max(0, 1 - placedFlags);
}

export function getCellIndex(size: GridSize, cell: CellCoordinates): number {
    return cell.column + size * cell.row;
}

export function isBorderCell(size: GridSize, cell: CellCoordinates): boolean {
    const lastIndex = size - 1;
    return cell.row === 0 || cell.column === 0 || cell.row === lastIndex || cell.column === lastIndex;
}

export function getSaveInputErrors(game: Game): string[] {
    const errors: string[] = [];

    if (!game.name.trim()) {
        errors.push('Le nom du jeu est requis.');
    }

    if (!game.description.trim()) {
        errors.push('La description du jeu est requise.');
    }

    return errors;
}

export function mergeErrors(existingErrors: string[], nextErrors: string[]): string[] {
    return [...new Set([...(existingErrors ?? []), ...nextErrors])];
}

export function generateShrineId(sequence: number): string {
    return `shrine-${sequence}`;
}
