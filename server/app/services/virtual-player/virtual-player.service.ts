import { GameSessionService } from '@app/services/game-session/game-session.service';
import { TileId } from '@common/game';
import { GameSessionState } from '@common/game-session';
import { PlayerType } from '@common/player';
import { Playstyle, RoomState, VirtualPlayerSummary } from '@common/wait-room';
import { Injectable } from '@nestjs/common';
import { DefensiveStrategy } from './strategy/defensive-strategy';
import { OffensiveStrategy } from './strategy/offensive-strategy';
import { Strategy, StrategyDecision } from './strategy/strategy';
import {
    randomVirtualPlayerDecisionDelayMs,
    randomVirtualPlayerGlideDecisionDelayMs,
    randomVirtualPlayerPostCombatTurnDelayMs,
    VIRTUAL_PLAYER_MAX_DECISIONS_PER_TURN,
    VIRTUAL_PLAYER_MAX_INITIAL_TURN_DELAY_MS,
} from './virtual-player-delay.util';
import { removePendingKeysForRoom } from './virtual-player-pending-keys.util';
import {
    runVirtualPlayerCombatAutomation,
    runVirtualPlayerFlagTransferAutomation,
    VirtualPlayerReactiveDeps,
} from './virtual-player-reactive-handlers';
import { areVirtualPlayerSnapshotsEqual, captureVirtualPlayerSnapshot } from './virtual-player-snapshot.util';
import { VirtualPlayerController } from './virtual-player.types';

@Injectable()
export class VirtualPlayerService {
    private readonly roomControllers = new Map<string, Map<string, VirtualPlayerController>>();
    private readonly processingRooms = new Set<string>();
    private readonly pendingCombatChoices = new Set<string>();
    private readonly pendingFlagTransferResponses = new Set<string>();
    private readonly previousTurnStartPositionByPlayer = new Map<string, string>();
    private readonly previousCountdownModeByRoom = new Map<string, GameSessionState['countdownMode']>();

    constructor(private readonly gameSessionService: GameSessionService) {}

    configureRoom(room: RoomState): void {
        const controllers = new Map<string, VirtualPlayerController>();

        for (const player of room.players) {
            if (player.playerType !== PlayerType.VirtualPlayer || !this.isVirtualPlayerSummary(player)) {
                continue;
            }

            controllers.set(player.id, {
                playstyle: player.playstyle,
                strategy: this.createStrategy(player.id, player.playstyle),
            });
        }

        if (controllers.size === 0) {
            this.roomControllers.delete(room.roomId);
            return;
        }

        this.roomControllers.set(room.roomId, controllers);
    }

    clearRoom(roomId: string): void {
        this.roomControllers.delete(roomId);
        this.processingRooms.delete(roomId);
        this.previousCountdownModeByRoom.delete(roomId);
        removePendingKeysForRoom(roomId, this.pendingCombatChoices);
        removePendingKeysForRoom(roomId, this.pendingFlagTransferResponses);
        for (const key of this.previousTurnStartPositionByPlayer.keys()) {
            if (key.startsWith(`${roomId}|`)) {
                this.previousTurnStartPositionByPlayer.delete(key);
            }
        }
    }

    onGameStateUpdate(gameState: GameSessionState): void {
        const previousCountdownMode = this.previousCountdownModeByRoom.get(gameState.roomId);
        this.previousCountdownModeByRoom.set(gameState.roomId, gameState.countdownMode);

        const reactiveDeps = this.getReactiveDeps();
        runVirtualPlayerFlagTransferAutomation(gameState, reactiveDeps);
        runVirtualPlayerCombatAutomation(gameState, reactiveDeps);

        if (gameState.phase === 'transition' || gameState.countdownMode === 'combat' || this.processingRooms.has(gameState.roomId)) {
            return;
        }

        const controller = this.roomControllers.get(gameState.roomId)?.get(gameState.activePlayerId);
        if (!controller) {
            return;
        }

        this.processingRooms.add(gameState.roomId);
        const playerKey = `${gameState.roomId}|${controller.strategy.getId()}`;
        const activePlayer = gameState.players.find((player) => player.id === controller.strategy.getId());
        const previousTurnStartPositionKey = this.previousTurnStartPositionByPlayer.get(playerKey);
        if (activePlayer) {
            this.previousTurnStartPositionByPlayer.set(playerKey, this.toPositionKey(activePlayer.position.row, activePlayer.position.column));
        }

        const initialDelayMs =
            previousCountdownMode === 'combat'
                ? randomVirtualPlayerPostCombatTurnDelayMs()
                : Math.random() * VIRTUAL_PLAYER_MAX_INITIAL_TURN_DELAY_MS;

        setTimeout(() => {
            const latestState = this.gameSessionService.getSession(gameState.roomId);
            if (!latestState || latestState.phase !== 'turn' || latestState.countdownMode === 'combat') {
                this.processingRooms.delete(gameState.roomId);
                return;
            }

            if (latestState.activePlayerId !== controller.strategy.getId()) {
                this.processingRooms.delete(gameState.roomId);
                return;
            }

            this.playTurnStep(latestState.roomId, controller, 0, new Set<string>(), new Set<string>(), previousTurnStartPositionKey);
        }, initialDelayMs);
    }

    private getReactiveDeps(): VirtualPlayerReactiveDeps {
        return {
            gameSessionService: this.gameSessionService,
            roomControllers: this.roomControllers,
            pendingCombatChoices: this.pendingCombatChoices,
            pendingFlagTransferResponses: this.pendingFlagTransferResponses,
        };
    }

    private playTurnStep(
        roomId: string,
        controller: VirtualPlayerController,
        decisionIndex: number,
        visitedStateKeys: Set<string>,
        visitedPositionKeys: Set<string>,
        previousTurnStartPositionKey?: string,
    ): void {
        const stateBeforeDecision = this.gameSessionService.getSession(roomId);
        if (!stateBeforeDecision || stateBeforeDecision.phase !== 'turn' || stateBeforeDecision.activePlayerId !== controller.strategy.getId()) {
            this.processingRooms.delete(roomId);
            return;
        }

        if (stateBeforeDecision.countdownMode === 'combat') {
            this.processingRooms.delete(roomId);
            return;
        }

        if (decisionIndex >= VIRTUAL_PLAYER_MAX_DECISIONS_PER_TURN) {
            this.finishTurn(roomId, controller.strategy);
            return;
        }

        const snapshotBeforeDecision = captureVirtualPlayerSnapshot(stateBeforeDecision, controller.strategy.getId());
        if (!snapshotBeforeDecision) {
            this.finishTurn(roomId, controller.strategy);
            return;
        }

        if (visitedStateKeys.size === 0) {
            visitedStateKeys.add(this.toTurnStateKey(snapshotBeforeDecision));
        }
        if (visitedPositionKeys.size === 0) {
            visitedPositionKeys.add(this.toPositionKey(snapshotBeforeDecision.row, snapshotBeforeDecision.column));
            if (previousTurnStartPositionKey) {
                visitedPositionKeys.add(previousTurnStartPositionKey);
            }
        }

        const decision = controller.strategy.process(stateBeforeDecision);
        if (decision.type === 'none') {
            this.finishTurn(roomId, controller.strategy);
            return;
        }

        const resolvedDecision = this.resolveDecisionWithVisitedMovePolicy(
            stateBeforeDecision,
            controller,
            snapshotBeforeDecision,
            decision,
            visitedPositionKeys,
        );
        if (!resolvedDecision || resolvedDecision.type === 'none') {
            this.finishTurn(roomId, controller.strategy);
            return;
        }

        this.executeDecision(roomId, controller.strategy.getId(), resolvedDecision);

        const stateAfterDecision = this.gameSessionService.getSession(roomId);
        if (!stateAfterDecision || stateAfterDecision.activePlayerId !== controller.strategy.getId()) {
            this.processingRooms.delete(roomId);
            return;
        }

        if (stateAfterDecision.phase !== 'turn' || stateAfterDecision.countdownMode === 'combat') {
            this.processingRooms.delete(roomId);
            return;
        }

        const snapshotAfterDecision = captureVirtualPlayerSnapshot(stateAfterDecision, controller.strategy.getId());
        if (!snapshotBeforeDecision || !snapshotAfterDecision || areVirtualPlayerSnapshotsEqual(snapshotBeforeDecision, snapshotAfterDecision)) {
            this.finishTurn(roomId, controller.strategy);
            return;
        }

        const stateAfterKey = this.toTurnStateKey(snapshotAfterDecision);
        if (visitedStateKeys.has(stateAfterKey)) {
            this.finishTurn(roomId, controller.strategy);
            return;
        }

        visitedStateKeys.add(stateAfterKey);
        visitedPositionKeys.add(this.toPositionKey(snapshotAfterDecision.row, snapshotAfterDecision.column));

        setTimeout(
            () => {
                this.playTurnStep(roomId, controller, decisionIndex + 1, visitedStateKeys, visitedPositionKeys, previousTurnStartPositionKey);
            },
            this.resolveNextDecisionDelayMs(resolvedDecision, snapshotBeforeDecision, snapshotAfterDecision),
        );
    }

    private resolveDecisionWithVisitedMovePolicy(
        stateBeforeDecision: GameSessionState,
        controller: VirtualPlayerController,
        snapshotBeforeDecision: NonNullable<ReturnType<typeof captureVirtualPlayerSnapshot>>,
        decision: StrategyDecision,
        visitedPositionKeys: Set<string>,
    ): StrategyDecision | undefined {
        if (decision.type !== 'move') {
            return decision;
        }

        if (!this.isVisitedMoveBlocked(decision.target, visitedPositionKeys, snapshotBeforeDecision)) {
            return decision;
        }

        const alternativeDecision = this.computeAlternativeDecisionAvoidingMoveTarget(stateBeforeDecision, controller, decision.target);
        if (!alternativeDecision || alternativeDecision.type === 'none') {
            return undefined;
        }

        if (alternativeDecision.type !== 'move') {
            return alternativeDecision;
        }

        return this.isVisitedMoveBlocked(alternativeDecision.target, visitedPositionKeys, snapshotBeforeDecision) ? undefined : alternativeDecision;
    }

    private isVisitedMoveBlocked(
        target: { row: number; column: number },
        visitedPositionKeys: Set<string>,
        snapshotBeforeDecision: NonNullable<ReturnType<typeof captureVirtualPlayerSnapshot>>,
    ): boolean {
        if (snapshotBeforeDecision.hasFlag) {
            return false;
        }

        const targetKey = this.toPositionKey(target.row, target.column);
        return visitedPositionKeys.has(targetKey);
    }

    private finishTurn(roomId: string, strategy: Strategy): void {
        try {
            const latestState = this.gameSessionService.getSession(roomId);
            if (!latestState || latestState.phase !== 'turn' || latestState.activePlayerId !== strategy.getId()) {
                return;
            }

            this.gameSessionService.endTurn(roomId, strategy.getId());
        } finally {
            this.processingRooms.delete(roomId);
        }
    }

    private executeDecision(roomId: string, playerId: string, decision: StrategyDecision): void {
        switch (decision.type) {
            case 'move':
                this.gameSessionService.movePlayer(roomId, playerId, decision.target);
                return;
            case 'action':
                this.gameSessionService.performAction(roomId, playerId, {
                    row: decision.target.row,
                    column: decision.target.column,
                    sanctuaryMode: decision.sanctuaryMode,
                });
                return;
            case 'none':
            default:
                return;
        }
    }

    private computeAlternativeDecisionAvoidingMoveTarget(
        stateBeforeDecision: GameSessionState,
        controller: VirtualPlayerController,
        blockedTarget: { row: number; column: number },
    ): StrategyDecision | undefined {
        const blockedCellExists = stateBeforeDecision.cells.some((cell) => cell.row === blockedTarget.row && cell.column === blockedTarget.column);
        if (!blockedCellExists) {
            return undefined;
        }

        const decisionState: GameSessionState = {
            ...stateBeforeDecision,
            cells: stateBeforeDecision.cells.map((cell) =>
                cell.row === blockedTarget.row && cell.column === blockedTarget.column ? { ...cell, tile: TileId.Wall } : cell,
            ),
        };

        if (process.env.VP_TRACE === '1') {
            // eslint-disable-next-line no-console
            console.log(`[VP] alt-decision id=${controller.strategy.getId()} block=${blockedTarget.row},${blockedTarget.column}`);
        }

        const alternativeDecision = controller.strategy.process(decisionState);
        if (
            alternativeDecision.type === 'move' &&
            alternativeDecision.target.row === blockedTarget.row &&
            alternativeDecision.target.column === blockedTarget.column
        ) {
            return undefined;
        }

        return alternativeDecision;
    }

    private resolveNextDecisionDelayMs(
        decision: StrategyDecision,
        snapshotBeforeDecision: NonNullable<ReturnType<typeof captureVirtualPlayerSnapshot>>,
        snapshotAfterDecision: NonNullable<ReturnType<typeof captureVirtualPlayerSnapshot>>,
    ): number {
        if (decision.type !== 'move') {
            return randomVirtualPlayerDecisionDelayMs();
        }

        const moved = snapshotBeforeDecision.row !== snapshotAfterDecision.row || snapshotBeforeDecision.column !== snapshotAfterDecision.column;
        const movementPointsUnchanged = snapshotBeforeDecision.movementPointsLeft === snapshotAfterDecision.movementPointsLeft;

        if (moved && movementPointsUnchanged) {
            return randomVirtualPlayerGlideDecisionDelayMs();
        }

        return randomVirtualPlayerDecisionDelayMs();
    }

    private createStrategy(playerId: string, playstyle: Playstyle): Strategy {
        return playstyle === Playstyle.Defensive ? new DefensiveStrategy(playerId) : new OffensiveStrategy(playerId);
    }

    private toTurnStateKey(snapshot: NonNullable<ReturnType<typeof captureVirtualPlayerSnapshot>>): string {
        return [
            snapshot.phase,
            snapshot.activePlayerId,
            snapshot.row,
            snapshot.column,
            snapshot.movementPointsLeft,
            snapshot.actionsLeft,
            snapshot.hasFlag,
        ].join('|');
    }

    private toPositionKey(row: number, column: number): string {
        return `${row},${column}`;
    }

    private isVirtualPlayerSummary(player: RoomState['players'][number]): player is VirtualPlayerSummary {
        return player.playerType === PlayerType.VirtualPlayer && 'playstyle' in player;
    }
}
