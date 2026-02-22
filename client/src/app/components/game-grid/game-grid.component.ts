import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { ObjectId, TileId } from '@common/game';

export interface GameGridCell {
    readonly row: number;
    readonly column: number;
    readonly tile: TileId;
    readonly object?: ObjectId;
    readonly shrineId?: string;
    readonly shrinePart?: 'TL' | 'TR' | 'BL' | 'BR';
}

export interface GameGridPointerEvent {
    readonly cell: GameGridCell;
    readonly button: 0 | 2; // 0 = left, 2 = right
    readonly shiftKey: boolean; // for SHIFT object deletion
}

@Component({
    selector: 'app-game-grid',
    standalone: true,
    templateUrl: './game-grid.component.html',
    styleUrls: ['./game-grid.component.scss'],
    imports: [CommonModule],
})
export class GameGridComponent {
    private isPainting = false;
    private activeButton: 0 | 2 | null = null;
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

    @Output()
    cellClicked = new EventEmitter<GameGridCell>();

    @Output()
    cellRightClicked = new EventEmitter<{ cell: GameGridCell; shiftKey: boolean }>();

    onGridMouseLeave(): void {
        this.isPainting = false;
        this.activeButton = null;
    }

    onCellMouseDown(event: MouseEvent, cell: GameGridCell): void {
        if (event.button !== 0 && event.button !== 2) return;

        this.isPainting = true;
        this.activeButton = event.button as 0 | 2;

        if (this.activeButton === 0) this.cellClicked.emit(cell);
        else this.cellRightClicked.emit({ cell, shiftKey: this.shiftKeyHeld });
    }

    onCellMouseEnter(cell: GameGridCell): void {
        if (!this.isPainting || this.activeButton === null) return;
        if (this.activeButton === 0 && !this.allowLeftDrag) return;

        if (this.activeButton === 0) this.cellClicked.emit(cell);
        else this.cellRightClicked.emit({ cell, shiftKey: this.shiftKeyHeld });
    }

    onCellRightClick(event: MouseEvent): void {
        event.preventDefault();
    }

    @HostListener('document:mouseup', ['$event'])
    onDocumentMouseUp(event: MouseEvent): void {
        if (event.button === 0 || event.button === 2) {
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

    getTileClass(cell: GameGridCell): string {
        return this.tileToolPrefix + cell.tile;
    }

    getObjectClass(obj: ObjectId): string {
        return this.objectToolPrefix + obj;
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
}
