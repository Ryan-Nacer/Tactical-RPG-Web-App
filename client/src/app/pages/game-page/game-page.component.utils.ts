import { GameGridCell, GameGridInspectEvent } from '@app/interfaces/game';

export function buildTeleportPayload(roomId: string, cell: GameGridCell) {
    return {
        roomId,
        row: cell.row,
        column: cell.column,
    };
}

export function shouldUpdateInspectionPopoverPosition(event: GameGridInspectEvent): boolean {
    return event.clientX !== 0 || event.clientY !== 0;
}

export function buildTransitionNotificationKey(roomId: string, activePlayerId: string | undefined): string {
    return `${roomId}:${activePlayerId ?? 'unknown'}:transition`;
}
