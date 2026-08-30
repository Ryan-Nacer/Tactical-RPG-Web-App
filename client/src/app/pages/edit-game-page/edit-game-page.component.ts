import { DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { EditHelpModalComponent } from '@app/components/edit-help-modal/edit-help-modal.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ErrorBoxComponent } from '@app/components/error-box/error-box.component';
import { GameGridComponent } from '@app/components/game-grid/game-grid.component';
import { GameGridCell, GameGridPlacementPreview, GameGridRightClickEvent } from '@app/interfaces/game';
import { ConfigService } from '@app/services/config.service';
import { GameClientService } from '@app/services/game-client.service';
import { MapEditorShrineService } from '@app/services/map-editor-shrine.service';
import { NotificationService } from '@app/services/notifications/notification.service';
import { SessionStorageClientService } from '@app/services/session-storage-client.service';
import { DoorState, Game, GridSize, Mode, ObjectId, TileId, Tool, emptyGame, isObjectTool, isTerrainTile, isTileTool } from '@common/game';
import { Subject, takeUntil } from 'rxjs';
import {
    computeRemainingFlag,
    computeRemainingStart,
    computeStartLimit,
    generateShrineId,
    getCellIndex,
    getSaveInputErrors,
    isBorderCell,
    mergeErrors,
} from './edit-game-page.utils';

@Component({
    selector: 'app-edit-game-page',
    standalone: true,
    imports: [GameGridComponent, ErrorBoxComponent, FormsModule, EditHelpModalComponent],
    templateUrl: './edit-game-page.component.html',
    styleUrls: ['./edit-game-page.component.scss'],
    providers: [DatePipe],
})
export class EditGamePageComponent implements OnInit, OnDestroy {
    readonly objectIdEnum = ObjectId;
    isTileTool = isTileTool;
    game: Game = emptyGame();
    selectedCell: GameGridCell | null = null;
    errors: string[] = [];
    activeTool: Tool = TileId.Wall;
    shrinePlacementPreview: GameGridPlacementPreview | null = null;
    shrinePlacementMessage = '';
    isHelpModalVisible = false;
    remainingMap = {
        [ObjectId.Start]: 0,
        [ObjectId.Flag]: 0,
        [ObjectId.Heal]: 0,
        [ObjectId.Combat]: 0,
    };

    @ViewChild('gridCapture') gridCapture!: ElementRef<HTMLElement>;
    readonly tileValues = Object.values(TileId);
    readonly objectValues = Object.values(ObjectId);
    private readonly baseTileId = TileId.Base;
    private isSaving = false;
    private isCancelling = false;
    private shrineSequence = 0;
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly datePipe = inject(DatePipe);
    readonly config = inject(ConfigService);
    private readonly gameClientService = inject(GameClientService);
    private readonly shrineService = inject(MapEditorShrineService);
    private readonly notificationService = inject(NotificationService);
    private readonly sessionStorageService = inject(SessionStorageClientService);

    private ngUnsubscribe = new Subject<void>();

    ngOnInit() {
        this.route.paramMap.pipe(takeUntil(this.ngUnsubscribe)).subscribe((params) => {
            const id = params.get('id');
            if (id) {
                this.game.id = id;
            }
            const game = id ? this.sessionStorageService.retrieveGameInSessionStorage(id) : undefined;
            const queryParams = this.route.snapshot.queryParamMap;
            this.initialiseGame(queryParams, game);
        });
    }

    ngOnDestroy() {
        this.ngUnsubscribe.next();
        this.ngUnsubscribe.complete();
    }

    private initialiseGame(params?: ParamMap, savedGame?: Game) {
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
        this.gameClientService
            .getGame(this.game.id ?? '')
            .pipe(takeUntil(this.ngUnsubscribe))
            .subscribe({
                next: (game) => {
                    if (savedGame !== undefined) {
                        game = savedGame;
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
                    this.notificationService.error('Failed to load game');
                },
            });
    }

    private saveToSessionStorage() {
        if (this.isCancelling) return;
        this.sessionStorageService.saveGameInSessionStorage(this.game);
    }

    @HostListener('window:beforeunload')
    unloadNotification(): void {
        this.saveToSessionStorage();
    }

    @HostListener('document:keydown.escape')
    onEscapePressed(): void {
        if (!this.isHelpModalVisible) {
            return;
        }

        this.closeHelpModal();
    }

    setActiveTool(tool: Tool): void {
        this.activeTool = tool;
        this.clearShrinePlacementPreview();
    }

    openHelpModal(): void {
        this.isHelpModalVisible = true;
    }

    closeHelpModal(): void {
        this.isHelpModalVisible = false;
    }

    getToolImageSrc(tool: Tool): string | null {
        if (tool === ObjectId.Flag) {
            return 'assets/objects/flag.png';
        }

        return null;
    }

    getIsSaving(): boolean {
        return this.isSaving;
    }

    private recomputeRemainingStart(): void {
        this.remainingMap[ObjectId.Start] = computeRemainingStart(this.game.cells, this.game.size);
    }

    private recomputeRemainingFlag(): void {
        this.remainingMap[ObjectId.Flag] = computeRemainingFlag(this.game.cells, this.game.mode);
    }

    private recomputeRemainingObjects(): void {
        this.recomputeRemainingStart();
        this.recomputeRemainingFlag();
        this.recomputeRemainingShrines();
    }

    onCellClicked(cell: GameGridCell): void {
        if (isTileTool(this.activeTool)) {
            this.selectedCell = this.applyTileToCell(cell, this.activeTool as TileId);
            this.clearShrinePlacementPreview();
            return;
        }
        if (isObjectTool(this.activeTool)) this.tryPlaceObject(cell, this.activeTool);
    }

    onGridCellHovered(cell: GameGridCell | null): void {
        if (!this.shrineService.isShrineTool(this.activeTool) || cell === null) {
            this.clearShrinePlacementPreview();
            return;
        }

        const preview = this.shrineService.evaluatePlacement(
            this.game.cells,
            this.game.size as GridSize,
            cell,
            this.activeTool,
            this.remainingMap[this.activeTool],
        );
        this.shrinePlacementPreview = {
            cells: preview.cells,
            isValid: preview.isValid,
            imageSrc: this.shrineService.getPreviewImageSrc(preview.object),
            topLeft: preview.cells[0],
        };
        this.shrinePlacementMessage = preview.reason;
    }

    onCellRightClicked(ev: GameGridRightClickEvent): void {
        const { cell, shiftKey } = ev;
        if (shiftKey) {
            this.tryDeleteObject(cell);
            this.clearShrinePlacementPreview();
            return;
        }
        this.selectedCell = this.applyTileToCell(cell, this.baseTileId);
        this.clearShrinePlacementPreview();
    }

    private tryDeleteObject(cell: GameGridCell): void {
        const index = getCellIndex(this.game.size, cell);
        const current = this.game.cells[index];
        if (current.shrineId) {
            this.clearShrine(current.shrineId);
            this.recomputeRemainingObjects();
            return;
        }
        if (!current.object) return;
        const updated: GameGridCell = { ...current, object: undefined };
        this.game.cells[index] = updated;
        this.recomputeRemainingObjects();
    }

    private initializeGrid(): void {
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
        this.clearShrinePlacementPreview();
    }

    onCancelClicked(): void {
        this.isCancelling = true;
        if (this.game.id) {
            this.sessionStorageService.removeGameFromSessionStorage(this.game.id);
        }
        this.router.navigate(['/admin-page'], { replaceUrl: true });
    }

    private applyTileToCell(cell: GameGridCell, tile: TileId): GameGridCell {
        const index = getCellIndex(this.game.size, cell);
        if (this.game.cells[index].shrineId && !isTerrainTile(tile) && tile !== this.game.cells[index].tile) {
            this.clearShrine(this.game.cells[index].shrineId as string);
        }
        const current = this.game.cells[index];

        if (tile === TileId.Door) {
            if (isBorderCell(this.game.size, cell)) {
                return current;
            }

            const toggledDoorState =
                current.tile === TileId.Door ? (current.doorState === DoorState.Open ? DoorState.Closed : DoorState.Open) : DoorState.Closed;
            const updatedDoorCell: GameGridCell = {
                ...current,
                tile: TileId.Door,
                object: undefined,
                doorState: toggledDoorState,
            };
            this.game.cells[index] = updatedDoorCell;
            this.recomputeRemainingObjects();
            return updatedDoorCell;
        }

        if (current.tile === tile && current.doorState === undefined) return current;
        const updatedCell: GameGridCell = {
            ...current,
            tile,
            object: isTerrainTile(tile) ? current.object : undefined,
            doorState: undefined,
        };
        this.game.cells[index] = updatedCell;
        this.recomputeRemainingObjects();
        return updatedCell;
    }

    get canSaveInput(): boolean {
        return this.game.name.trim().length > 0 && this.game.description.trim().length > 0;
    }

    get canSaveGame(): boolean {
        return this.game.cells.filter((c) => c.object === 'start').length === computeStartLimit(this.game.size);
    }

    onSaveButtonClicked(): void {
        this.errors = [];
        if (!this.canSaveInput) {
            this.reportErrors(getSaveInputErrors(this.game));
            return;
        }
        const now = new Date();
        const formatedNow: string | null = this.datePipe.transform(now, 'yyyy-MM-dd');
        this.isSaving = true;
        const game: Game = {
            ...this.game,
            lastModified: formatedNow ?? '',
        };
        this.gameClientService
            .saveGame(game, this.gridCapture)
            .pipe(takeUntil(this.ngUnsubscribe))
            .subscribe({
                next: () => {
                    this.notificationService.success('Sauvegarde reussie!', { duration: 5000 });
                    this.errors = [];
                    this.router.navigate(['/admin-page'], { replaceUrl: true });
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
        this.errors = mergeErrors(this.errors, errors);
    }

    private tryPlaceObject(cell: GameGridCell, object: ObjectId): void {
        if (object === ObjectId.Heal || object === ObjectId.Combat) {
            this.tryPlaceShrine(cell, object);
            return;
        }

        const index = getCellIndex(this.game.size, cell);
        const current = this.game.cells[index];
        if (!isTerrainTile(current.tile) || current.object || this.remainingMap[object] === 0) return;
        this.game.cells[index] = { ...current, object };
        this.recomputeRemainingObjects();
    }

    private recomputeRemainingShrines(): void {
        const remainingShrines = this.shrineService.computeRemainingShrines(this.game.cells, this.game.size as GridSize);
        this.remainingMap[ObjectId.Heal] = remainingShrines;
        this.remainingMap[ObjectId.Combat] = remainingShrines;
    }

    private tryPlaceShrine(cell: GameGridCell, object: ObjectId.Heal | ObjectId.Combat): void {
        const preview = this.shrineService.evaluatePlacement(this.game.cells, this.game.size as GridSize, cell, object, this.remainingMap[object]);
        if (!preview.isValid) {
            return;
        }

        this.shrineSequence += 1;
        const shrineId = generateShrineId(this.shrineSequence);
        this.game.cells = this.shrineService.placeShrine(this.game.cells, this.game.size as GridSize, preview.cells, object, shrineId);
        this.recomputeRemainingObjects();
        this.clearShrinePlacementPreview();
    }

    private clearShrine(shrineId: string): void {
        this.game.cells = this.shrineService.clearShrine(this.game.cells, shrineId);
    }

    private clearShrinePlacementPreview(): void {
        this.shrinePlacementPreview = null;
        this.shrinePlacementMessage = '';
    }
}
