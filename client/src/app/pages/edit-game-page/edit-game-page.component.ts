import { DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ErrorBoxComponent } from '@app/components/error-box/error-box.component';
import { GameGridCell, GameGridComponent } from '@app/components/game-grid/game-grid.component';
import { GameClientService } from '@app/services/game-client.service';
import { SessionStorageClientService } from '@app/services/session-storage-client.service';
import { Game as GameCommon, Mode, ObjectId, TileId, Tool, isTerrainTile, isTileTool, isObjectTool } from '@common/game';
import { Game as GameClient, GridSize, emptyGame, toGameCommon } from '@app/interfaces/game';
import { ConfigService } from '@app/services/config.service';

const gridSizeToPlayerCountMap = {
    [GridSize.Small]: 2,
    [GridSize.Medium]: 4,
    [GridSize.Large]: 6,
};

@Component({
    selector: 'app-edit-game-page',
    standalone: true,
    imports: [GameGridComponent, ErrorBoxComponent, FormsModule],
    templateUrl: './edit-game-page.component.html',
    styleUrl: './edit-game-page.component.scss',
    providers: [DatePipe],
})
export class EditGamePageComponent {
    isTileTool = isTileTool;
    game: GameClient = emptyGame();
    selectedCell: GameGridCell | null = null;
    errors: string[] = [];
    activeTool: Tool = TileId.Wall;
    remainingMap = {
        [ObjectId.Start]: 0,
        [ObjectId.Flag]: 0,
        [ObjectId.Heal]: 0,
        [ObjectId.Combat]: 0,
    };
    readonly config = inject(ConfigService);

    @ViewChild('gridCapture') gridCapture!: ElementRef<HTMLElement>;
    readonly tileValues = Object.values(TileId);
    readonly objectValues = Object.values(ObjectId);
    private readonly baseTileId = TileId.Base;
    private isSaving = false;
    private isCancelling = false;
    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private datePipe: DatePipe,
        private readonly gameClientService: GameClientService,
        private readonly sessionStorageService: SessionStorageClientService,
    ) {
        this.route.paramMap.subscribe((params) => {
            const id = params.get('id');
            if (id !== null) {
                this.game.id = id;
            }
            const game = id !== null ? this.sessionStorageService.retrieveGameInSessionStorage(id) : undefined;
            const queryParams = this.route.snapshot.queryParamMap;
            this.initialiseGame(queryParams, game);
        });
    }

    initialiseGame(params?: ParamMap, savedGame?: GameClient) {
        if (params !== undefined) {
            const mode = params.get('mode');
            const size = params.get('size');
            if (mode) {
                this.game.mode = mode as Mode;
            }
            if (size) {
                this.game.size = Number(size);
            }
        }
        if (!this.game.id) {
            this.initializeGrid();
            this.recomputeRemainingObjects();
            return;
        }
        this.gameClientService.getGame(this.game.id ?? '').subscribe({
            next: (game) => {
                if (savedGame !== undefined) {
                    game = { ...savedGame, size: savedGame.size.toString() };
                }
                this.game = { ...game, size: +game.size };
                this.initializeGrid();
                const expectedCellCount = this.game.size * this.game.size;
                if (Array.isArray(game.cells) && game.cells.length === expectedCellCount) {
                    this.game.cells = game.cells;
                }
                this.recomputeRemainingObjects();
            },
            error: () => {
                alert('Failed to load game');
            },
        });
    }
    saveToSessionStorage() {
        if (this.isCancelling) return;
        this.sessionStorageService.saveGameInSessionStorage(this.game);
    }

    @HostListener('window:beforeunload')
    unloadNotification(): void {
        this.saveToSessionStorage();
    }

    setActiveTool(tool: Tool): void {
        this.activeTool = tool;
    }

    getIsSaving(): boolean {
        return this.isSaving;
    }

    private computeStartLimit(): number {
        return gridSizeToPlayerCountMap[this.game.size];
    }

    private recomputeRemainingStart(): void {
        const limit = this.computeStartLimit();
        const placed = this.game.cells.filter((c) => c.object === ObjectId.Start).length;
        this.remainingMap[ObjectId.Start] = Math.max(0, limit - placed);
    }

    private recomputeRemainingFlag(): void {
        if (this.game.mode !== Mode.CTF) {
            this.remainingMap[ObjectId.Flag] = 0;
            return;
        }
        const placed = this.game.cells.filter((c) => c.object === 'flag').length;
        this.remainingMap[ObjectId.Flag] = Math.max(0, 1 - placed);
    }

    private recomputeRemainingObjects(): void {
        this.recomputeRemainingStart();
        this.recomputeRemainingFlag();
    }

    onCellClicked(cell: GameGridCell): void {
        if (isTileTool(this.activeTool)) {
            this.selectedCell = this.applyTileToCell(cell, this.activeTool as TileId);
            return;
        }
        if (isObjectTool(this.activeTool)) this.tryPlaceObject(cell, this.activeTool);
    }

    onCellRightClicked(ev: { cell: GameGridCell; shiftKey: boolean }): void {
        const { cell, shiftKey } = ev;
        if (shiftKey) {
            this.tryDeleteObject(cell);
            return;
        }
        this.selectedCell = this.applyTileToCell(cell, this.baseTileId);
    }

    private tryDeleteObject(cell: GameGridCell): void {
        const index = this.getCellIndex(cell);
        const current = this.game.cells[index];
        if (!current.object) return;
        const updated: GameGridCell = { ...current, object: undefined };
        this.game.cells[index] = updated;
        this.recomputeRemainingObjects();
    }

    private initializeGrid(): void {
        // Selon l'initialisation, la formule de l'indexe est x + this.game.size * y
        this.game.cells = [];
        for (let row = 0; row < this.game.size; row++) {
            for (let column = 0; column < this.game.size; column++) {
                this.game.cells.push({ row, column, tile: this.baseTileId });
            }
        }
    }

    onResetClicked(): void {
        const queryParams = this.route.snapshot.queryParamMap;
        this.initialiseGame(queryParams);
    }

    onCancelClicked(): void {
        this.isCancelling = true;
        if (this.game.id) {
            this.sessionStorageService.removeGameFromSessionStorage(this.game.id);
        }
        this.router.navigate(['/admin-page']);
    }

    private applyTileToCell(cell: GameGridCell, tile: TileId): GameGridCell {
        const index = this.getCellIndex(cell);
        const current = this.game.cells[index];
        if (current.tile === tile) return current;
        const updatedCell: GameGridCell = {
            ...current,
            tile,
            object: isTerrainTile(tile) ? current.object : undefined,
        };
        this.game.cells[index] = updatedCell;
        this.recomputeRemainingObjects();
        return updatedCell;
    }

    private getCellIndex(cell: GameGridCell): number {
        return cell.column + this.game.size * cell.row;
    }

    get canSaveInput(): boolean {
        return this.game.name.trim().length > 0 && this.game.description.trim().length > 0;
    }

    get canSaveGame(): boolean {
        return this.game.cells.filter((c) => c.object === 'start').length === this.computeStartLimit();
    }

    onSaveButtonClicked(): void {
        this.errors = [];
        if (!this.canSaveInput) {
            const localErrors: string[] = [];
            if (!this.game.name.trim()) {
                localErrors.push('Le nom du jeu est requis.');
            }
            if (!this.game.description.trim()) {
                localErrors.push('La description du jeu est requise.');
            }
            this.reportErrors(localErrors);
            return;
        }
        const now = new Date();
        const formatedNow: string | null = this.datePipe.transform(now, 'yyyy-MM-dd');
        this.isSaving = true;
        const game: GameCommon = {
            ...toGameCommon(this.game),
            lastModified: formatedNow ?? '',
        };
        this.gameClientService.saveGame(game, this.gridCapture).subscribe({
            next: () => {
                alert('Sauvegarde réussie');
                this.errors = [];
                this.router.navigate(['/admin-page']);
            },
            error: (err: unknown) => {
                this.reportErrors(this.gameClientService.extractErrors(err));
                this.isSaving = false;
            },
            complete: () => {
                this.isSaving = false;
            },
        });

        this.sessionStorageService.removeGameFromSessionStorage(this.game.id);
    }

    private reportErrors(errors: string[]): void {
        const merged = [...new Set([...(this.errors ?? []), ...errors])];
        this.errors = merged;
    }

    // Enlevé le check pour placer flag, car il est impossible que l'objet actif
    // soit flag si mode n'est pas CTF
    // Enlevé check s'il reste un objet. Objet est inselectionable s'il en reste
    // plus

    private tryPlaceObject(cell: GameGridCell, object: ObjectId): void {
        const index = this.getCellIndex(cell);
        const current = this.game.cells[index];
        if (!isTerrainTile(current.tile) || current.object) return;
        this.game.cells[index] = { ...current, object };
        this.recomputeRemainingObjects();
    }
}
