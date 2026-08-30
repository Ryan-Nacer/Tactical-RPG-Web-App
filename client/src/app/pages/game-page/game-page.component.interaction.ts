import { Directive } from '@angular/core';
import { GameGridCell, GameGridInspectEvent, GameGridReachableCell } from '@app/interfaces/game';
import { CombatPosture } from '@common/combat';
import { ObjectId, TileId } from '@common/game';
import { GameSessionPlayer, SanctuaryActionMode } from '@common/game-session';
import { GamePageComponentCombat } from './game-page.component.combat';
import { buildTeleportPayload, shouldUpdateInspectionPopoverPosition } from './game-page.component.utils';

@Directive()
export abstract class GamePageComponentInteraction extends GamePageComponentCombat {
    get actionTargetBoardCells(): GameGridReachableCell[] {
        if (!this.actionPrimed || !this.canPrimeAction || !this.currentPlayer || !this.session) {
            return [];
        }

        return this.getAvailableActionTargets();
    }

    get hasAvailableActionTargets(): boolean {
        return this.getAvailableActionTargets().length > 0;
    }

    get canToggleActionButton(): boolean {
        if (!this.canPrimeAction) {
            return false;
        }

        return this.actionPrimed || this.hasAvailableActionTargets;
    }

    get shouldHighlightObviousAction(): boolean {
        if (this.actionPrimed || this.pendingSanctuaryChoice || this.isAbandonConfirmVisible || !this.canPrimeAction) {
            return false;
        }

        return this.hasAvailableActionTargets;
    }

    get actionButtonHint(): string {
        if (this.actionPrimed || this.pendingSanctuaryChoice || this.isAbandonConfirmVisible || !this.canEndTurn) {
            return '';
        }

        if ((this.currentPlayer?.actionsLeft ?? 0) <= 0) {
            return 'Aucune action restante ce tour.';
        }

        if (this.canPrimeAction && !this.hasAvailableActionTargets) {
            return 'Aucune action possible pour le moment.';
        }

        return '';
    }

    finishTurnEarly(): void {
        if (!this.roomId || !this.canRequestTurnEnd) {
            return;
        }

        this.roomSocketService.endTurn({ roomId: this.roomId });
    }

    toggleActionMode(): void {
        if (this.pendingSanctuaryChoice || this.isAbandonConfirmVisible || !this.canPrimeAction) {
            return;
        }

        if (!this.actionPrimed && !this.hasAvailableActionTargets) {
            return;
        }

        this.actionPrimed = !this.actionPrimed;
    }

    openAbandonConfirm(): void {
        this.isAbandonConfirmVisible = true;
    }

    openHelpModal(): void {
        this.isHelpModalVisible = true;
    }

    closeHelpModal(): void {
        this.isHelpModalVisible = false;
    }

    closeAbandonConfirm(): void {
        this.isAbandonConfirmVisible = false;
    }

    abandonGame(): void {
        this.isAbandonConfirmVisible = false;
        this.leaveCurrentRoom();
        this.navigateToHome();
    }

    toggleDebugMode(): void {
        if (!this.roomId || !this.canToggleDebug) {
            return;
        }

        this.roomSocketService.toggleDebug({ roomId: this.roomId });
    }

    onBoardCellClicked(cell: GameGridCell): void {
        this.closeInspectionPopover();

        if (this.pendingSanctuaryChoice || !this.actionPrimed || !this.roomId || !this.canPrimeAction) {
            return;
        }

        if (this.isShrineCell(cell) && this.isActionTargetCell(cell)) {
            this.pendingSanctuaryChoice = {
                row: cell.row,
                column: cell.column,
                shrineId: cell.shrineId,
                object: cell.object,
            };
            return;
        }

        this.roomSocketService.performAction({
            roomId: this.roomId,
            row: cell.row,
            column: cell.column,
        });
        this.actionPrimed = false;
    }

    onBoardCellRightClicked(event: GameGridInspectEvent): void {
        if (this.shouldTeleportOnRightClick()) {
            this.teleportPlayerToCell(event.cell);
            return;
        }

        this.openInspectionPopover(event);
    }

    selectMessagesTab(tab: 'chat' | 'journal'): void {
        this.activeMessagesTab = tab;
    }

    closeInspectionPopover(): void {
        this.inspectedCell = null;
    }

    onCombatPostureSelected(posture: CombatPosture): void {
        if (!this.roomId || !this.isCombatOverlayVisible) {
            return;
        }

        this.roomSocketService.chooseCombatPosture({
            roomId: this.roomId,
            posture,
        });
    }

    onCombatResultCloseRequested(): void {
        this.dismissCombatResultMessage();
    }

    chooseSanctuaryMode(mode: SanctuaryActionMode): void {
        if (!this.roomId || !this.pendingSanctuaryChoice || !this.canKeepPendingSanctuaryChoiceOpen()) {
            this.pendingSanctuaryChoice = null;
            return;
        }

        this.roomSocketService.performAction({
            roomId: this.roomId,
            row: this.pendingSanctuaryChoice.row,
            column: this.pendingSanctuaryChoice.column,
            sanctuaryMode: mode,
        });
        this.pendingSanctuaryChoice = null;
        this.actionPrimed = false;
    }

    closeSanctuaryChoice(): void {
        this.pendingSanctuaryChoice = null;
    }

    respondToFlagTransfer(accepted: boolean): void {
        if (!this.roomId || !this.pendingFlagTransferRequest) {
            return;
        }

        this.roomSocketService.respondToFlagTransfer({
            roomId: this.roomId,
            accepted,
        });
        this.pendingFlagTransferRequest = null;
    }

    getSanctuaryChoiceTitle(): string {
        if (this.pendingSanctuaryChoice?.object === ObjectId.Heal) {
            return 'Sanctuaire de soin';
        }

        return 'Sanctuaire de combat';
    }

    protected handleEscapePressed(): void {
        if (this.isHelpModalVisible) {
            this.closeHelpModal();
            return;
        }

        if (this.isAbandonConfirmVisible) {
            this.closeAbandonConfirm();
            return;
        }

        if (this.pendingSanctuaryChoice) {
            this.closeSanctuaryChoice();
            return;
        }

        this.closeInspectionPopover();
    }

    protected handleKeyUp(event: KeyboardEvent): void {
        if (this.isHelpModalVisible || this.pendingSanctuaryChoice || this.isAbandonConfirmVisible) {
            return;
        }

        const payload = this.gamePageMovementService.resolveMovePayload(event, this.roomId, this.canEndTurn, this.currentPlayer);
        if (!payload) {
            return;
        }

        this.roomSocketService.movePlayer(payload);
    }

    protected handleDebugShortcutPressed(event: KeyboardEvent): void {
        if (!this.gamePageStateService.shouldToggleDebugShortcut(event)) {
            return;
        }

        this.toggleDebugMode();
    }

    protected syncCurrentPlayer(): void {
        this.currentPlayer = this.gamePagePlayerService.getCurrentPlayerFromSocket(this.session, this.roomSocketService.socketId);
    }

    protected syncFromSession(): void {
        const viewState = this.gamePageStateService.getViewState(this.session, this.actionPrimed, this.canPrimeAction);
        this.countdownSeconds = viewState.countdownSeconds;
        this.debugMode = viewState.debugMode;
        this.messages = viewState.messages;
        this.actionPrimed = viewState.actionPrimed;
        this.syncPendingSanctuaryChoice();
        this.syncPendingFlagTransferRequest();
        this.syncCombatOverlayVisibility();
    }

    protected shouldTeleportOnRightClick(): boolean {
        return this.gamePageStateService.shouldTeleportOnRightClick(this.session, this.currentPlayer, this.activePlayer);
    }

    protected teleportPlayerToCell(cell: GameGridCell): void {
        if (!this.roomId) {
            return;
        }

        this.closeInspectionPopover();
        this.roomSocketService.teleportPlayer(buildTeleportPayload(this.roomId, cell));
    }

    protected openInspectionPopover(event: GameGridInspectEvent): void {
        this.inspectedCell = event.cell;

        if (!shouldUpdateInspectionPopoverPosition(event)) {
            return;
        }

        this.inspectionPopoverPosition = this.gamePageInspectionService.getInspectionPopoverPosition(event.clientX, event.clientY);
    }

    private getAdjacentShrineTargets(currentPosition: { row: number; column: number }): GameGridReachableCell[] {
        const shrineGroups = new Map<string, GameGridCell[]>();
        for (const cell of this.boardCells) {
            if (!this.isShrineCell(cell) || (cell.shrineCooldownTurns ?? 0) > 0) {
                continue;
            }

            const shrineKey = cell.shrineId ?? `legacy-${cell.row}-${cell.column}`;
            const shrineCells = shrineGroups.get(shrineKey) ?? [];
            shrineCells.push(cell);
            shrineGroups.set(shrineKey, shrineCells);
        }

        const targets: GameGridReachableCell[] = [];
        for (const shrineCells of shrineGroups.values()) {
            const isAdjacent = shrineCells.some((cell) => this.isAdjacentToCurrentPosition(currentPosition, cell));
            if (!isAdjacent) {
                continue;
            }

            targets.push(...shrineCells.map((cell) => ({ row: cell.row, column: cell.column })));
        }

        return targets;
    }

    private getAvailableActionTargets(): GameGridReachableCell[] {
        if (!this.currentPlayer || !this.session) {
            return [];
        }

        const currentPosition = this.currentPlayer.position;
        const adjacentEnemyTargets = this.session.players
            .filter((player) => !player.hasAbandoned && player.id !== this.currentPlayer?.id)
            .filter((player) => this.arePlayersEnemies(this.currentPlayer as GameSessionPlayer, player))
            .filter((player) => this.isAdjacentToCurrentPosition(currentPosition, player.position))
            .map((player) => ({ row: player.position.row, column: player.position.column }));
        const adjacentTransferTargets = this.session.players
            .filter((player) => !player.hasAbandoned && player.id !== this.currentPlayer?.id)
            .filter((player) => this.canTransferFlagWithTeammate(this.currentPlayer as GameSessionPlayer, player))
            .filter((player) => this.isAdjacentToCurrentPosition(currentPosition, player.position))
            .map((player) => ({ row: player.position.row, column: player.position.column, targetType: 'transfer' as const }));

        const adjacentDoorTargets = this.boardCells
            .filter((cell) => cell.tile === TileId.Door)
            .filter((cell) => this.isAdjacentToCurrentPosition(currentPosition, cell))
            .map((cell) => ({ row: cell.row, column: cell.column }));

        const adjacentShrineTargets = this.getAdjacentShrineTargets(currentPosition);

        const deduplicatedTargets = new Map(
            [...adjacentEnemyTargets, ...adjacentTransferTargets, ...adjacentDoorTargets, ...adjacentShrineTargets].map((cell) => [
                `${cell.row},${cell.column}`,
                cell,
            ]),
        );

        return Array.from(deduplicatedTargets.values());
    }

    private isAdjacentToCurrentPosition(currentPosition: { row: number; column: number }, targetPosition: { row: number; column: number }): boolean {
        const rowDistance = Math.abs(targetPosition.row - currentPosition.row);
        const columnDistance = Math.abs(targetPosition.column - currentPosition.column);
        return rowDistance + columnDistance === 1;
    }

    private isShrineCell(cell: GameGridCell): cell is GameGridCell & { object: ObjectId.Heal | ObjectId.Combat } {
        return cell.object === ObjectId.Heal || cell.object === ObjectId.Combat;
    }

    private isActionTargetCell(cell: GameGridCell): boolean {
        return this.actionTargetBoardCells.some((targetCell) => targetCell.row === cell.row && targetCell.column === cell.column);
    }

    private arePlayersEnemies(firstPlayer: GameSessionPlayer, secondPlayer: GameSessionPlayer): boolean {
        if (!firstPlayer.team || !secondPlayer.team) {
            return true;
        }

        return firstPlayer.team !== secondPlayer.team;
    }

    private canTransferFlagWithTeammate(firstPlayer: GameSessionPlayer, secondPlayer: GameSessionPlayer): boolean {
        return (
            this.isCtfMode &&
            !!firstPlayer.team &&
            firstPlayer.team === secondPlayer.team &&
            Boolean(firstPlayer.hasFlag) !== Boolean(secondPlayer.hasFlag)
        );
    }

    private syncPendingSanctuaryChoice(): void {
        if (!this.pendingSanctuaryChoice) {
            return;
        }

        if (!this.canKeepPendingSanctuaryChoiceOpen()) {
            this.pendingSanctuaryChoice = null;
        }
    }

    private canKeepPendingSanctuaryChoiceOpen(): boolean {
        if (!this.pendingSanctuaryChoice || !this.canPrimeAction) {
            return false;
        }

        return this.actionTargetBoardCells.some(
            (cell) => cell.row === this.pendingSanctuaryChoice?.row && cell.column === this.pendingSanctuaryChoice?.column,
        );
    }

    private syncPendingFlagTransferRequest(): void {
        if (!this.pendingFlagTransferRequest || !this.session) {
            return;
        }

        if (this.session.phase !== 'turn' || this.session.activePlayerId !== this.pendingFlagTransferRequest.initiatorId) {
            this.pendingFlagTransferRequest = null;
        }
    }

    protected abstract leaveCurrentRoom(markReturnToMain?: boolean): void;
    protected abstract navigateToHome(): void;
}
