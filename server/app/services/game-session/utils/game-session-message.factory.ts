import { CombatTurnResult } from '@common/combat';
import { GameJournalAudience, GameJournalEventType, GameSessionMessage, GameSessionPlayer, GameSessionState } from '@common/game-session';

function buildJournalMessage(
    text: string,
    type: GameSessionMessage['type'],
    options: {
        eventType: GameJournalEventType;
        involvedPlayers?: GameSessionPlayer[];
        audience?: GameJournalAudience;
        visibleToPlayerIds?: string[];
        authorPlayerId?: string;
        authorName?: string;
    },
): GameSessionMessage {
    return {
        id: `${Date.now()}-${text}`,
        text,
        type,
        createdAt: new Date().toISOString(),
        authorPlayerId: options.authorPlayerId,
        authorName: options.authorName,
        eventType: options.eventType,
        audience: options.audience ?? 'all',
        visibleToPlayerIds: options.visibleToPlayerIds,
        involvedPlayerIds: options.involvedPlayers?.map((player) => player.id) ?? [],
    };
}

export function buildSystemMessage(
    text: string,
    eventType: GameJournalEventType = 'generic',
    involvedPlayers: GameSessionPlayer[] = [],
): GameSessionMessage {
    return buildJournalMessage(text, 'system', {
        eventType,
        involvedPlayers,
        audience: 'all',
    });
}

export function buildPlayerMessage(
    text: string,
    player: GameSessionPlayer,
    eventType: GameJournalEventType = 'generic',
    involvedPlayers: GameSessionPlayer[] = [player],
): GameSessionMessage {
    return buildJournalMessage(text, 'player', {
        eventType,
        involvedPlayers,
        audience: 'all',
        authorPlayerId: player.id,
        authorName: player.name,
    });
}

export function buildCombatMessage(text: string, attacker: GameSessionPlayer, defender: GameSessionPlayer): GameSessionMessage {
    return buildJournalMessage(text, 'combat', {
        eventType: 'combat-round',
        involvedPlayers: [attacker, defender],
        audience: 'players',
        visibleToPlayerIds: [attacker.id, defender.id],
        authorPlayerId: attacker.id,
        authorName: `${attacker.name} vs ${defender.name}`,
    });
}

export function formatSignedValue(value: number): string {
    if (value > 0) {
        return `+${value}`;
    }

    return `${value}`;
}

export function buildCombatCalculationMessage(
    attacker: GameSessionPlayer,
    defender: GameSessionPlayer,
    turnResult: CombatTurnResult,
    calculationType: 'attack' | 'defense',
): GameSessionMessage {
    if (calculationType === 'attack') {
        const attackBonus = formatSignedValue(turnResult.attackerAttackPostureBonus);
        const attackPenalty = formatSignedValue(-turnResult.attackerAttackPenalty);
        return buildCombatMessage(
            `Attaque de ${attacker.name} contre ${defender.name} : ` +
                `base ${turnResult.attackerAttackBase}, bonus posture ${attackBonus}, ` +
                `resultat du de ${attacker.attackDice} (${turnResult.attackerAttackDiceRoll}), ` +
                `malus ${attackPenalty}, total ${turnResult.attackerAttackTotal}.`,
            attacker,
            defender,
        );
    }

    const defenseBonus = formatSignedValue(turnResult.defenderDefensePostureBonus);
    const defensePenalty = formatSignedValue(-turnResult.defenderDefensePenalty);
    return buildCombatMessage(
        `Defense de ${defender.name} contre ${attacker.name} : ` +
            `base ${turnResult.defenderDefenseBase}, bonus posture ${defenseBonus}, ` +
            `resultat du de ${defender.defenseDice} (${turnResult.defenderDefenseDiceRoll}), ` +
            `malus ${defensePenalty}, total ${turnResult.defenderDefenseTotal}.`,
        attacker,
        defender,
    );
}

export function buildCombatResolutionMessage(
    attacker: GameSessionPlayer,
    defender: GameSessionPlayer,
    turnResult: CombatTurnResult,
): GameSessionMessage {
    const difference = turnResult.attackerAttackTotal - turnResult.defenderDefenseTotal;
    return buildCombatMessage(
        `Resolution ${attacker.name} -> ${defender.name} : ${turnResult.attackerAttackTotal} - ${turnResult.defenderDefenseTotal} = ${difference}.`,
        attacker,
        defender,
    );
}

export function buildCombatOutcomeMessage(
    attacker: GameSessionPlayer,
    defender: GameSessionPlayer,
    turnResult: CombatTurnResult,
): GameSessionMessage {
    const outcomeText = turnResult.damageDealt > 0 ? `${turnResult.damageDealt} degat(s) inflige(s) a ${defender.name}.` : 'aucun degat.';

    return buildCombatMessage(`Resultat ${attacker.name} -> ${defender.name} : ${outcomeText}`, attacker, defender);
}

export function buildCombatRoundDetailMessages(
    attacker: GameSessionPlayer,
    defender: GameSessionPlayer,
    attackerToDefender: CombatTurnResult,
    defenderToAttacker: CombatTurnResult,
): GameSessionMessage[] {
    return [
        buildCombatCalculationMessage(attacker, defender, attackerToDefender, 'attack'),
        buildCombatCalculationMessage(attacker, defender, attackerToDefender, 'defense'),
        buildCombatResolutionMessage(attacker, defender, attackerToDefender),
        buildCombatOutcomeMessage(attacker, defender, attackerToDefender),
        buildCombatCalculationMessage(defender, attacker, defenderToAttacker, 'attack'),
        buildCombatCalculationMessage(defender, attacker, defenderToAttacker, 'defense'),
        buildCombatResolutionMessage(defender, attacker, defenderToAttacker),
        buildCombatOutcomeMessage(defender, attacker, defenderToAttacker),
    ];
}

export function canPlayerViewMessage(message: GameSessionMessage, playerId: string): boolean {
    if (!message.visibleToPlayerIds?.length) {
        return true;
    }

    return message.visibleToPlayerIds.includes(playerId);
}

export function filterMessagesForPlayerView(session: GameSessionState, playerId: string): GameSessionMessage[] {
    return session.messages.filter((message) => canPlayerViewMessage(message, playerId));
}
