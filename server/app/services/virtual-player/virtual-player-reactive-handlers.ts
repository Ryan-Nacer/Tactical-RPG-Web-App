import { GameSessionService } from '@app/services/game-session/game-session.service';
import { CombatPosture } from '@common/combat';
import { GameSessionState } from '@common/game-session';
import { Playstyle } from '@common/wait-room';
import { VirtualPlayerController } from './virtual-player.types';
import { randomVirtualPlayerCombatDecisionDelayMs, randomVirtualPlayerFlagTransferDelayMs } from './virtual-player-delay.util';

export function resolveVirtualPlayerCombatPosture(playstyle: Playstyle): CombatPosture {
    return playstyle === Playstyle.Defensive ? CombatPosture.Defensive : CombatPosture.Offensive;
}

export type VirtualPlayerReactiveDeps = {
    gameSessionService: GameSessionService;
    roomControllers: Map<string, Map<string, VirtualPlayerController>>;
    pendingCombatChoices: Set<string>;
    pendingFlagTransferResponses: Set<string>;
};

export function runVirtualPlayerCombatAutomation(gameState: GameSessionState, deps: VirtualPlayerReactiveDeps): void {
    if (gameState.countdownMode !== 'combat' || !gameState.combatState) {
        return;
    }

    queueVirtualPlayerCombatPosture(gameState, gameState.combatState.attackerId, gameState.combatState.attackerPosture, deps);
    queueVirtualPlayerCombatPosture(gameState, gameState.combatState.defenderId, gameState.combatState.defenderPosture, deps);
}

export function runVirtualPlayerFlagTransferAutomation(gameState: GameSessionState, deps: VirtualPlayerReactiveDeps): void {
    const pendingTransfer = deps.gameSessionService.getPendingFlagTransfer(gameState.roomId);
    if (!pendingTransfer) {
        return;
    }

    if (!deps.roomControllers.get(gameState.roomId)?.get(pendingTransfer.teammateId)) {
        return;
    }

    const pendingKey = `${gameState.roomId}:${pendingTransfer.teammateId}`;
    if (deps.pendingFlagTransferResponses.has(pendingKey)) {
        return;
    }

    deps.pendingFlagTransferResponses.add(pendingKey);

    setTimeout(() => {
        try {
            const latestPendingTransfer = deps.gameSessionService.getPendingFlagTransfer(gameState.roomId);
            if (!latestPendingTransfer || latestPendingTransfer.teammateId !== pendingTransfer.teammateId) {
                return;
            }

            const latestState = deps.gameSessionService.getSession(gameState.roomId);
            const teammate = latestState?.players.find((player) => player.id === pendingTransfer.teammateId && !player.hasAbandoned);
            if (!teammate) {
                return;
            }

            deps.gameSessionService.respondToFlagTransfer(gameState.roomId, pendingTransfer.teammateId, true);
        } finally {
            deps.pendingFlagTransferResponses.delete(pendingKey);
        }
    }, randomVirtualPlayerFlagTransferDelayMs());
}

function queueVirtualPlayerCombatPosture(
    gameState: GameSessionState,
    playerId: string,
    selectedPosture: CombatPosture | undefined,
    deps: VirtualPlayerReactiveDeps,
): void {
    if (selectedPosture) {
        return;
    }

    const controller = deps.roomControllers.get(gameState.roomId)?.get(playerId);
    if (!controller) {
        return;
    }

    const pendingKey = `${gameState.roomId}:${playerId}`;
    if (deps.pendingCombatChoices.has(pendingKey)) {
        return;
    }

    deps.pendingCombatChoices.add(pendingKey);

    setTimeout(() => {
        try {
            const latestState = deps.gameSessionService.getSession(gameState.roomId);
            if (!latestState || latestState.countdownMode !== 'combat' || !latestState.combatState) {
                return;
            }

            const isAttacker = latestState.combatState.attackerId === playerId;
            const isDefender = latestState.combatState.defenderId === playerId;
            if (!isAttacker && !isDefender) {
                return;
            }

            const postureAlreadyChosen = isAttacker ? latestState.combatState.attackerPosture : latestState.combatState.defenderPosture;
            if (postureAlreadyChosen) {
                return;
            }

            deps.gameSessionService.chooseCombatPosture(gameState.roomId, playerId, resolveVirtualPlayerCombatPosture(controller.playstyle));
        } finally {
            deps.pendingCombatChoices.delete(pendingKey);
        }
    }, randomVirtualPlayerCombatDecisionDelayMs());
}
