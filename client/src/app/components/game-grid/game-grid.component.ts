import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import {
    GameGridCell,
    GameGridInspectEvent,
    GameGridPlacementPreview,
    GameGridPlayerMarker,
    GameGridReachableCell,
    MouseButton,
} from '@app/interfaces/game';
import { DoorState, ObjectId, ShrinePart, TileId } from '@common/game';

const PLAYER_SIZE_MIN_PX = 20;
const PLAYER_SIZE_MAX_PX = 64;
const PLAYER_SIZE_REFERENCE_BOARD_SIZE_PX = 600;

@Component({
    selector: 'app-game-grid',
    standalone: true,
    templateUrl: './game-grid.component.html',
    styleUrls: ['./game-grid.component.scss'],
    imports: [CommonModule],
})
export class GameGridComponent {
    private isPainting = false;
    private activeButton: MouseButton | null = null;
    readonly objectIdEnum = ObjectId;
    readonly tileToolPrefix = 'tile-';
    readonly objectToolPrefix = 'obj-';
    private shiftKeyHeld = false;

    @Input()
    gridSize = 0;

    @Input()
    cells: GameGridCell[] = [];

    @Input()
    selectedCell: GameGridCell | null = null;

    @Input()
    allowLeftDrag = true;

    @Input()
    players: GameGridPlayerMarker[] = [];

    @Input()
    isCtfMode = false;

    @Input()
    reachableCells: GameGridReachableCell[] = [];

    @Input()
    actionTargetCells: GameGridReachableCell[] = [];

    @Input()
    placementPreview: GameGridPlacementPreview | null = null;

    @Output()
    cellClicked = new EventEmitter<GameGridCell>();

    @Output()
    cellRightClicked = new EventEmitter<GameGridInspectEvent>();

    @Output()
    cellHovered = new EventEmitter<GameGridCell | null>();

    onGridMouseLeave(): void {
        this.isPainting = false;
        this.activeButton = null;
        this.cellHovered.emit(null);
    }

    onCellMouseDown(event: MouseEvent, cell: GameGridCell): void {
        if (event.button !== MouseButton.Left && event.button !== MouseButton.Right) return;

        this.isPainting = true;
        this.activeButton = event.button as MouseButton;

        if (this.activeButton === MouseButton.Left) this.cellClicked.emit(cell);
        else this.cellRightClicked.emit({ cell, shiftKey: this.shiftKeyHeld, clientX: event.clientX, clientY: event.clientY });
    }

    onCellMouseEnter(cell: GameGridCell): void {
        this.cellHovered.emit(cell);
        if (!this.isPainting || this.activeButton === null) return;
        if (this.activeButton === MouseButton.Left && !this.allowLeftDrag) return;

        if (this.activeButton === MouseButton.Left) this.cellClicked.emit(cell);
        else this.cellRightClicked.emit({ cell, shiftKey: this.shiftKeyHeld, clientX: 0, clientY: 0 });
    }

    onCellRightClick(event: MouseEvent): void {
        event.preventDefault();
    }

    @HostListener('document:mouseup', ['$event'])
    onDocumentMouseUp(event: MouseEvent): void {
        if (event.button === MouseButton.Left || event.button === MouseButton.Right) {
            this.isPainting = false;
            this.activeButton = null;
        }
    }

    @HostListener('document:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Shift') {
            this.shiftKeyHeld = true;
        }
    }

    @HostListener('document:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent): void {
        if (event.key === 'Shift') {
            this.shiftKeyHeld = false;
        }
    }

    isSelected(cell: GameGridCell): boolean {
        return this.selectedCell?.row === cell.row && this.selectedCell?.column === cell.column;
    }

    get gridTemplate(): string {
        return `repeat(${this.gridSize}, 1fr)`;
    }

    get playerSizePx(): number {
        if (this.gridSize <= 0) {
            return PLAYER_SIZE_MAX_PX;
        }

        const estimatedSize = Math.round(PLAYER_SIZE_REFERENCE_BOARD_SIZE_PX / this.gridSize);
        return Math.max(PLAYER_SIZE_MIN_PX, Math.min(PLAYER_SIZE_MAX_PX, estimatedSize));
    }

    getTileClass(cell: GameGridCell): string {
        return this.tileToolPrefix + cell.tile;
    }

    isDoorOpen(cell: GameGridCell): boolean {
        return cell.doorState === DoorState.Open;
    }

    isDoorClosed(cell: GameGridCell): boolean {
        return cell.tile === TileId.Door && !this.isDoorOpen(cell);
    }

    isShrineTopLeft(cell: GameGridCell): boolean {
        return (cell.object === ObjectId.Heal || cell.object === ObjectId.Combat) && cell.shrinePart === ShrinePart.TopLeft;
    }

    isShrineInactive(cell: GameGridCell): boolean {
        return (cell.object === ObjectId.Heal || cell.object === ObjectId.Combat) && (cell.shrineCooldownTurns ?? 0) > 0;
    }

    getObjectClass(obj: ObjectId): string {
        return this.objectToolPrefix + obj;
    }

    shouldRenderObjectFallback(cell: GameGridCell): boolean {
        if (cell.object !== ObjectId.Heal && cell.object !== ObjectId.Combat) {
            return true;
        }

        return !cell.shrineId;
    }

    getObjectImageSrc(cell: GameGridCell): string | null {
        if (cell.object === ObjectId.Flag) {
            return 'assets/objects/flag.png';
        }

        if (cell.object === ObjectId.Heal && this.isShrineTopLeft(cell)) {
            return 'assets/objects/health.png';
        }

        if (cell.object === ObjectId.Combat && this.isShrineTopLeft(cell)) {
            return 'assets/objects/combat.png';
        }

        return null;
    }

    getObjectDescription(object: string | undefined): string {
        switch (object) {
            case 'start':
                return 'Point de départ\nDétermine un point de départ possible';
            case 'flag':
                return 'Drapeau\nDétermine la position possible des drapeaux';
            case 'heal':
                return "Sanctuaire de soin\nÀ l'utilisation, permet de regagner 2 HP\nPrends 2x2 tuiles";
            case 'combat':
                return "Sanctuaire de combat\nÀ l'utilisation, ajoute temporairement 1 point\nà l'attribut attaque et défense\nPrends 2x2 tuiles";
            default:
                return '';
        }
    }

    getPlayersAtCell(cell: GameGridCell): GameGridPlayerMarker[] {
        return this.players.filter((player) => player.row === cell.row && player.column === cell.column);
    }

    getPlayerMarkerLabel(player: GameGridPlayerMarker): string {
        const compactName = player.name.replace(/\s+/g, '').toUpperCase();
        return compactName[0] ?? 'P';
    }

    isReachable(cell: GameGridCell): boolean {
        return this.containsCellCoordinates(this.reachableCells, cell);
    }

    isActionTarget(cell: GameGridCell): boolean {
        return this.containsCellCoordinates(this.actionTargetCells, cell);
    }

    isTransferTarget(cell: GameGridCell): boolean {
        return this.actionTargetCells.some(
            (targetCell) => targetCell.row === cell.row && targetCell.column === cell.column && targetCell.targetType === 'transfer',
        );
    }

    isPlacementPreviewCell(cell: GameGridCell): boolean {
        return this.containsCellCoordinates(this.placementPreview?.cells ?? [], cell);
    }

    isValidPlacementPreview(cell: GameGridCell): boolean {
        return this.isPlacementPreviewCell(cell) && !!this.placementPreview?.isValid;
    }

    isInvalidPlacementPreview(cell: GameGridCell): boolean {
        return this.isPlacementPreviewCell(cell) && this.placementPreview?.isValid === false;
    }

    isPlacementPreviewTopLeft(cell: GameGridCell): boolean {
        return this.placementPreview?.topLeft?.row === cell.row && this.placementPreview?.topLeft?.column === cell.column;
    }

    private containsCellCoordinates(cells: GameGridReachableCell[], targetCell: GameGridCell): boolean {
        return cells.some((cell) => cell.row === targetCell.row && cell.column === targetCell.column);
    }
}
