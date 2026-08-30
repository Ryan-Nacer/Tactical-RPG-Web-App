import { Injectable } from '@angular/core';
import { GameGridCell } from '@app/interfaces/game';
import { DoorState, ObjectId, TileId, getTerrainMovementCost } from '@common/game';
import { GameSessionPlayer, GameSessionState, MovePlayerPayload } from '@common/game-session';

const WASD_DELTAS: Record<string, { rowDelta: number; columnDelta: number }> = {
    w: { rowDelta: -1, columnDelta: 0 },
    a: { rowDelta: 0, columnDelta: -1 },
    s: { rowDelta: 1, columnDelta: 0 },
    d: { rowDelta: 0, columnDelta: 1 },
};

@Injectable({
    providedIn: 'root',
})
export class GamePageMovementService {
    resolveMovePayload(event: KeyboardEvent, roomId: string, canEndTurn: boolean, currentPlayer: GameSessionPlayer | null): MovePlayerPayload | null {
        if (!this.canHandleKeyboardMovement(event, roomId, canEndTurn, currentPlayer)) {
            return null;
        }

        const delta = WASD_DELTAS[event.key.toLowerCase()];
        if (!delta || !currentPlayer) {
            return null;
        }

        event.preventDefault();
        return {
            roomId,
            row: currentPlayer.position.row + delta.rowDelta,
            column: currentPlayer.position.column + delta.columnDelta,
        };
    }

    getReachableCells(cells: GameGridCell[], session: GameSessionState, currentPlayer: GameSessionPlayer): GameGridCell[] {
        const cellByKey = this.buildCellIndex(cells);
        const occupiedKeys = this.buildOccupiedCellKeys(session, currentPlayer.id);
        const start = currentPlayer.position;
        const reachableKeys = this.computeReachableKeys(cellByKey, occupiedKeys, start, currentPlayer.movementPointsLeft);

        return reachableKeys.map((key) => cellByKey.get(key)).filter((cell): cell is GameGridCell => cell !== undefined);
    }

    private buildCellIndex(cells: GameGridCell[]): Map<string, GameGridCell> {
        const cellByKey = new Map<string, GameGridCell>();
        for (const cell of cells) {
            cellByKey.set(this.cellKey(cell.row, cell.column), cell);
        }
        return cellByKey;
    }

    private buildOccupiedCellKeys(session: GameSessionState, currentPlayerId: string): Set<string> {
        return new Set(
            session.players
                .filter((player) => !player.hasAbandoned && player.id !== currentPlayerId)
                .map((player) => this.cellKey(player.position.row, player.position.column)),
        );
    }

    private computeReachableKeys(
        cellByKey: Map<string, GameGridCell>,
        occupiedKeys: Set<string>,
        start: { row: number; column: number },
        startMovement: number,
    ): string[] {
        const startKey = this.cellKey(start.row, start.column);
        const bestRemainingMovement = new Map<string, number>([[startKey, startMovement]]);
        const queue: { row: number; column: number; pointsLeft: number }[] = [{ row: start.row, column: start.column, pointsLeft: startMovement }];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }

            const neighbors = [
                { row: current.row - 1, column: current.column },
                { row: current.row + 1, column: current.column },
                { row: current.row, column: current.column - 1 },
                { row: current.row, column: current.column + 1 },
            ];

            for (const neighbor of neighbors) {
                const neighborKey = this.cellKey(neighbor.row, neighbor.column);
                const neighborCell = cellByKey.get(neighborKey);
                if (!neighborCell || this.isBlockedCell(neighborCell) || occupiedKeys.has(neighborKey)) {
                    continue;
                }

                const nextPointsLeft = current.pointsLeft - getTerrainMovementCost(neighborCell.tile);
                const previousBest = bestRemainingMovement.get(neighborKey);
                if (nextPointsLeft < 0 || (previousBest !== undefined && previousBest >= nextPointsLeft)) {
                    continue;
                }

                bestRemainingMovement.set(neighborKey, nextPointsLeft);
                queue.push({ row: neighbor.row, column: neighbor.column, pointsLeft: nextPointsLeft });
            }
        }

        return Array.from(bestRemainingMovement.keys()).filter((key) => key !== startKey);
    }

    private cellKey(row: number, column: number): string {
        return `${row},${column}`;
    }

    private isBlockedCell(cell: GameGridCell): boolean {
        return (
            cell.tile === TileId.Wall ||
            (cell.tile === TileId.Door && cell.doorState !== DoorState.Open) ||
            cell.object === ObjectId.Heal ||
            cell.object === ObjectId.Combat
        );
    }

    private canHandleKeyboardMovement(event: KeyboardEvent, roomId: string, canEndTurn: boolean, currentPlayer: GameSessionPlayer | null): boolean {
        if (!roomId || !canEndTurn || !currentPlayer) {
            return false;
        }

        const target = event.target as HTMLElement | null;
        if (!target) {
            return true;
        }

        const tagName = target.tagName.toLowerCase();
        if (target.isContentEditable) {
            return false;
        }

        return tagName !== 'input' && tagName !== 'textarea';
    }
}
