import { CombatResolutionService } from '@app/services/combat/combat-resolution.service';
import { 
    buildCombatMessage, 
    buildCombatRoundDetailMessages, 
    buildSystemMessage } from '@app/services/game-session/utils/game-session-message.factory';
import { COMBAT_TURN_DURATION_SECONDS, CombatPosture, CombatTurnResult } from '@common/combat';
import { Mode } from '@common/game';
import { CombatEndPayload, GameSessionMessage, GameSessionPlayer, GameSessionState } from '@common/game-session';

const COMBAT_VICTORY_TARGET = 3;

interface CombatOutcome {
    winner?: GameSessionPlayer;
    loser?: GameSessionPlayer;
    isTie: boolean;
}

export interface GameSessionCombatHooks {
    appendMessage: (session: GameSessionState, message: GameSessionMessage) => void;
    emitCombatEnd: (payload: CombatEndPayload) => void;
    dropFlagOnDefeatTile: (session: GameSessionState, defeatedPlayer: GameSessionPlayer) => void;
    teleportToSpawn: (session: GameSessionState, player: GameSessionPlayer) => void;
    completeTurn: (session: GameSessionState, player: GameSessionPlayer) => void;
    getMode: (roomId: string) => Mode | undefined;
}

export class GameSessionCombatService {
    private readonly preCombatTurnRemainingSeconds = new Map<string, number>();

    constructor(private readonly combatResolutionService: CombatResolutionService) {}

    startCombat(session: GameSessionState, attackerId: string, defenderId: string, hooks: GameSessionCombatHooks): void {
        const attacker = session.players.find((player) => !player.hasAbandoned && player.id === attackerId);
        const defender = session.players.find((player) => !player.hasAbandoned && player.id === defenderId);
        if (!attacker || !defender) {
            return;
        }

        attacker.combatsTotal = (attacker.combatsTotal ?? 0) + 1;
        defender.combatsTotal = (defender.combatsTotal ?? 0) + 1;
        hooks.appendMessage(
            session,
            buildSystemMessage(`Le combat commence entre ${attacker.name} et ${defender.name}.`, 'combat-start', [attacker, defender]),
        );

        session.combatState = {
            attackerId,
            defenderId,
            currentTurnNumber: 1,
            turnsHistory: [],
        };
        this.preCombatTurnRemainingSeconds.set(session.roomId, session.turnRemainingSeconds);
        session.countdownMode = 'combat';
        session.countdownCombatPlayerIds = [attackerId, defenderId];
        session.turnRemainingSeconds = COMBAT_TURN_DURATION_SECONDS;
    }

    resolveCombatRound(session: GameSessionState, hooks: GameSessionCombatHooks): void {
        if (!session.combatState) {
            return;
        }

        const attacker = session.players.find((player) => !player.hasAbandoned && player.id === session.combatState?.attackerId);
        const defender = session.players.find((player) => !player.hasAbandoned && player.id === session.combatState?.defenderId);
        if (!attacker || !defender) {
            this.endCombat(session);
            return;
        }

        const combatOutcome = this.resolveCombat(session, attacker, defender, hooks);

        if (this.processCombatRoundOutcome(session, attacker, defender, combatOutcome, hooks)) {
            return;
        }

        if (!session.combatState) {
            return;
        }

        session.combatState.currentTurnNumber += 1;
        session.combatState.attackerPosture = undefined;
        session.combatState.defenderPosture = undefined;
        session.turnRemainingSeconds = COMBAT_TURN_DURATION_SECONDS;
    }

    endCombat(session: GameSessionState): void {
        session.combatState = undefined;
        const preCombatTurnRemainingSeconds = this.preCombatTurnRemainingSeconds.get(session.roomId);
        this.preCombatTurnRemainingSeconds.delete(session.roomId);

        if (session.winnerPlayerId) {
            session.countdownCombatPlayerIds = [];
            return;
        }

        session.countdownMode = session.phase === 'transition' ? 'transition' : 'turn';
        session.countdownCombatPlayerIds = [];
        if (session.countdownMode === 'turn') {
            session.turnRemainingSeconds = Math.max(1, preCombatTurnRemainingSeconds ?? session.turnRemainingSeconds);
        }
    }

    private resolveCombat(
        session: GameSessionState,
        attacker: GameSessionPlayer,
        defender: GameSessionPlayer,
        hooks: GameSessionCombatHooks,
    ): CombatOutcome {
        const attackerPosture = session.combatState?.attackerPosture ?? CombatPosture.Neutral;
        const defenderPosture = session.combatState?.defenderPosture ?? CombatPosture.Neutral;

        const turnResult = this.combatResolutionService.resolveCombatTurnSimultaneous(session, attacker, defender, attackerPosture, defenderPosture);

        if (session.combatState) {
            session.combatState.turnsHistory = [...session.combatState.turnsHistory, turnResult.attackerToDefender, turnResult.defenderToAttacker];
        }

        this.appendCombatRoundDetails(
            session,
            attacker,
            defender,
            { attackerToDefender: turnResult.attackerToDefender, defenderToAttacker: turnResult.defenderToAttacker },
            hooks,
        );

        this.updateTotalHealthDamage(attacker, defender, turnResult.attackerHealthAfter, turnResult.defenderHealthAfter);
        defender.health = turnResult.defenderHealthAfter;
        attacker.health = turnResult.attackerHealthAfter;

        const attackerDefeated = attacker.health === 0;
        const defenderDefeated = defender.health === 0;

        if (attackerDefeated && defenderDefeated) {
            hooks.appendMessage(session, buildSystemMessage('Le combat se termine ex aequo. aucun champion.', 'combat-end', [attacker, defender]));
            hooks.dropFlagOnDefeatTile(session, attacker);
            hooks.dropFlagOnDefeatTile(session, defender);
            hooks.teleportToSpawn(session, attacker);
            hooks.teleportToSpawn(session, defender);
            attacker.health = attacker.maxHealth;
            defender.health = defender.maxHealth;
            return { isTie: true };
        }

        if (defenderDefeated) {
            attacker.combatsWon += 1;
            hooks.appendMessage(
                session,
                buildSystemMessage(`${attacker.name} gagne le combat contre ${defender.name}`, 'combat-end', [attacker, defender]),
            );
            hooks.dropFlagOnDefeatTile(session, defender);
            hooks.teleportToSpawn(session, defender);
            defender.health = defender.maxHealth;

            if (session.activePlayerId === defender.id) {
                hooks.completeTurn(session, defender);
            }
            return { winner: attacker, loser: defender, isTie: false };
        }

        if (attackerDefeated) {
            defender.combatsWon += 1;
            hooks.appendMessage(
                session,
                buildSystemMessage(`${defender.name} gagne le combat contre ${attacker.name}`, 'combat-end', [defender, attacker]),
            );
            hooks.dropFlagOnDefeatTile(session, attacker);
            hooks.teleportToSpawn(session, attacker);
            attacker.health = attacker.maxHealth;

            if (session.activePlayerId === attacker.id) {
                hooks.completeTurn(session, attacker);
            }
            return { winner: defender, loser: attacker, isTie: false };
        }

        return { isTie: false };
    }

    private processCombatRoundOutcome(
        session: GameSessionState,
        attacker: GameSessionPlayer,
        defender: GameSessionPlayer,
        combatOutcome: CombatOutcome,
        hooks: GameSessionCombatHooks,
    ): boolean {
        const loser = combatOutcome.loser;

        if (combatOutcome.winner) {
            hooks.appendMessage(
                session,
                buildCombatMessage(
                    `${combatOutcome.winner.name} a gagné le combat contre ${loser?.name ?? 'son adversaire'}.`,
                    combatOutcome.winner,
                    loser ?? defender,
                ),
            );
        } else if (combatOutcome.isTie) {
            hooks.appendMessage(session, buildCombatMessage('Le combat se termine ex aequo. aucun champion.', attacker, defender));
        }

        const isClassicMode = hooks.getMode(session.roomId) !== Mode.CTF;
        if (isClassicMode && combatOutcome.winner?.combatsWon === COMBAT_VICTORY_TARGET) {
            hooks.emitCombatEnd({
                roomId: session.roomId,
                attackerId: attacker.id,
                defenderId: defender.id,
                winnerId: combatOutcome.winner.id,
                loserId: loser?.id,
                isTie: false,
                reason: 'game-over',
            });
            session.winnerPlayerId = combatOutcome.winner.id;
            session.endTime = Date.now();
            session.activePlayerId = '';
            session.phase = 'turn';
            session.countdownMode = 'disabled';
            session.countdownCombatPlayerIds = [];
            session.turnRemainingSeconds = 0;
            hooks.appendMessage(
                session,
                buildSystemMessage(`${combatOutcome.winner.name} remporte la partie avec ${COMBAT_VICTORY_TARGET} victoires.`, 'game-end', [
                    combatOutcome.winner,
                ]),
            );
            this.endCombat(session);
            return true;
        }

        if (combatOutcome.winner || combatOutcome.isTie) {
            hooks.emitCombatEnd({
                roomId: session.roomId,
                attackerId: attacker.id,
                defenderId: defender.id,
                winnerId: combatOutcome.winner?.id,
                loserId: loser?.id,
                isTie: combatOutcome.isTie,
                reason: combatOutcome.isTie ? 'tie' : 'knockout',
            });
            this.endCombat(session);
            return true;
        }

        return false;
    }

    private updateTotalHealthDamage(
        attacker: GameSessionPlayer,
        defender: GameSessionPlayer,
        newAttackerHealth: number,
        newDefenderHealth: number,
    ): void {
        const damageToDefender = defender.health - newDefenderHealth;
        const damageToAttacker = attacker.health - newAttackerHealth;

        defender.totalDamageTaken = (defender.totalDamageTaken ?? 0) + Math.max(0, damageToDefender);
        attacker.totalDamageTaken = (attacker.totalDamageTaken ?? 0) + Math.max(0, damageToAttacker);
        attacker.totalDamageDone = (attacker.totalDamageDone ?? 0) + Math.max(0, damageToDefender);
        defender.totalDamageDone = (defender.totalDamageDone ?? 0) + Math.max(0, damageToAttacker);
    }

    private appendCombatRoundDetails(
        session: GameSessionState,
        attacker: GameSessionPlayer,
        defender: GameSessionPlayer,
        turnResults: { attackerToDefender: CombatTurnResult; defenderToAttacker: CombatTurnResult },
        hooks: GameSessionCombatHooks,
    ): void {
        for (const message of buildCombatRoundDetailMessages(attacker, defender, turnResults.attackerToDefender, turnResults.defenderToAttacker)) {
            hooks.appendMessage(session, message);
        }
    }
}
