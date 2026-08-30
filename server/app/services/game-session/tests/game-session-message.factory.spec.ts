import {
    createTestPlayer,
    createTestSession,
} from '@app/services/game-session/tests/game-session-sub-services.spec.utils';
import {
    buildCombatMessage,
    buildCombatRoundDetailMessages,
    buildPlayerMessage,
    buildSystemMessage,
    canPlayerViewMessage,
    filterMessagesForPlayerView,
    formatSignedValue,
} from '@app/services/game-session/utils/game-session-message.factory';
import { CombatPosture, CombatTurnResult } from '@common/combat';

/**
 * Portee :
 * - utilitaires de fabrique de journal/messages
 * Cas limites :
 * - filtrage de visibilité des messages de combat privés
 * - formatage des nombres signes
 * - construction complete des messages de detail de manche
 */
/**
 * Strategie :
 * - tester game-session-message.factory sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('game-session-message.factory', () => {
    const attacker = createTestPlayer('player-1', { name: 'Attaquant' });
    const defender = createTestPlayer('player-2', { name: 'Defenseur' });

    const makeTurnResult = (): CombatTurnResult => ({
        attackerId: attacker.id,
        defenderId: defender.id,
        attackerPosture: CombatPosture.Offensive,
        attackerAttackBase: 4,
        attackerAttackPostureBonus: 2,
        attackerAttackDiceRoll: 1,
        attackerAttackPenalty: 0,
        attackerAttackTotal: 7,
        defenderPosture: CombatPosture.Defensive,
        defenderDefenseBase: 4,
        defenderDefensePostureBonus: 2,
        defenderDefenseDiceRoll: 1,
        defenderDefensePenalty: 0,
        defenderDefenseTotal: 7,
        damageDealt: 0,
        defenderHealthAfter: 6,
    });

    it('builds system and player messages with expected metadata', () => {
        const system = buildSystemMessage('Message systeme', 'generic', [attacker]);
        expect(system.type).toBe('system');
        expect(system.eventType).toBe('generic');
        expect(system.involvedPlayerIds).toEqual([attacker.id]);

        const player = buildPlayerMessage('Message joueur', attacker, 'turn-start');
        expect(player.type).toBe('player');
        expect(player.authorPlayerId).toBe(attacker.id);
        expect(player.authorName).toBe(attacker.name);
    });

    it('builds combat message visible only to combatants', () => {
        const message = buildCombatMessage('Combat test', attacker, defender);

        expect(message.type).toBe('combat');
        expect(message.audience).toBe('players');
        expect(message.visibleToPlayerIds).toEqual([attacker.id, defender.id]);
    });

    it('formats signed values', () => {
        expect(formatSignedValue(2)).toBe('+2');
        expect(formatSignedValue(0)).toBe('0');
        expect(formatSignedValue(-3)).toBe('-3');
    });

    it('builds all detail messages for a combat round', () => {
        const first = makeTurnResult();
        const second = { ...makeTurnResult(), attackerId: defender.id, defenderId: attacker.id } as CombatTurnResult;

        const messages = buildCombatRoundDetailMessages(attacker, defender, first, second);

        expect(messages).toHaveLength(8);
        expect(messages.every((message) => message.type === 'combat')).toBe(true);
        expect(messages[0].text).toContain(`resultat du de ${attacker.attackDice}`);
        expect(messages[1].text).toContain(`resultat du de ${defender.defenseDice}`);
        expect(messages[4].text).toContain(`resultat du de ${defender.attackDice}`);
        expect(messages[5].text).toContain(`resultat du de ${attacker.defenseDice}`);
    });

    it('filters messages according to visibility', () => {
        const session = createTestSession([attacker, defender]);
        const publicMessage = buildSystemMessage('Public');
        const privateMessage = buildCombatMessage('Prive', attacker, defender);

        session.messages = [publicMessage, privateMessage];

        expect(canPlayerViewMessage(publicMessage, 'spectator')).toBe(true);
        expect(canPlayerViewMessage(privateMessage, attacker.id)).toBe(true);
        expect(canPlayerViewMessage(privateMessage, 'spectator')).toBe(false);

        const spectatorMessages = filterMessagesForPlayerView(session, 'spectator');
        expect(spectatorMessages.map((message) => message.text)).toEqual(['Public']);
    });
});
