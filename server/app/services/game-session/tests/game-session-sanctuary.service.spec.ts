import { GameSessionSanctuaryHooks, GameSessionSanctuaryService } from '@app/services/game-session/sub-services/game-session-sanctuary.service';
import {
    createAppendMessageMock,
    createTestPlayer as createPlayer,
    createTestSession,
} from '@app/services/game-session/tests/game-session-sub-services.spec.utils';
import { ObjectId, ShrinePart, TileId } from '@common/game';
import { GameSessionPlayer, GameSessionState } from '@common/game-session';

const SHRINE_COOLDOWN_TURNS = 3;
const LOW_HEALTH = 3;
const HEALED_HEALTH = 5;
const BOOSTED_STAT = 5;
const BASE_STAT = 4;

const createShrineCells = (object: ObjectId.Heal | ObjectId.Combat, shrineId: string) => [
    { row: 0, column: 1, tile: TileId.Base, object, shrineId, shrinePart: ShrinePart.TopLeft, shrineCooldownTurns: 0 },
    { row: 0, column: 2, tile: TileId.Base, object, shrineId, shrinePart: ShrinePart.TopRight, shrineCooldownTurns: 0 },
    { row: 1, column: 1, tile: TileId.Base, object, shrineId, shrinePart: ShrinePart.BottomLeft, shrineCooldownTurns: 0 },
    { row: 1, column: 2, tile: TileId.Base, object, shrineId, shrinePart: ShrinePart.BottomRight, shrineCooldownTurns: 0 },
];

const createSession = (players: GameSessionPlayer[], cells: GameSessionState['cells']): GameSessionState => createTestSession(players, {}, cells);

const createHooks = (): GameSessionSanctuaryHooks & { appendMessage: jest.Mock } => ({
    appendMessage: createAppendMessageMock(),
});

/**
 * Portee :
 * - effets des sanctuaires et mécaniques de cooldown
 * Cas limites :
 * - règles de disponibilité/cooldown des sanctuaires
 * - issues du mode double ou rien
 * - expiration des bonus temporaires de combat
 */
/**
 * Strategie :
 * - tester GameSessionSanctuaryService sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('GameSessionSanctuaryService', () => {
    let service: GameSessionSanctuaryService;

    beforeEach(() => {
        service = new GameSessionSanctuaryService();
    });

    it('uses a heal sanctuary from any shrine tile and starts shrine cooldown', () => {
        const player = createPlayer('player-1', { position: { row: 0, column: 0 }, health: LOW_HEALTH });
        const session = createSession([player], [
            { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
            ...createShrineCells(ObjectId.Heal, 'shrine-1'),
        ]);
        const hooks = createHooks();

        const used = service.tryUseSanctuary(session, player, { row: 1, column: 2 }, 'normal', hooks);

        expect(used).toBe(true);
        expect(player.health).toBe(HEALED_HEALTH);
        expect(session.cells.filter((cell) => cell.shrineId === 'shrine-1').every((cell) => cell.shrineCooldownTurns === SHRINE_COOLDOWN_TURNS)).toBe(
            true,
        );
        expect(session.cells.filter((cell) => cell.shrineId === 'shrine-1').every((cell) => cell.shrineUsed === true)).toBe(true);
        expect(session.messages.at(-1)?.text).toContain('sanctuaire de soin');
        expect(session.messages.at(-1)).toMatchObject({ eventType: 'sanctuary', involvedPlayerIds: ['player-1'] });
    });

    it('applies and expires combat sanctuary bonus with turn progression helper', () => {
        const player = createPlayer('player-1', { position: { row: 0, column: 0 }, attack: BASE_STAT, defense: BASE_STAT });
        const session = createSession([player], [
            { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
            ...createShrineCells(ObjectId.Combat, 'shrine-2'),
        ]);
        const hooks = createHooks();

        const used = service.tryUseSanctuary(session, player, { row: 0, column: 2 }, 'normal', hooks);

        expect(used).toBe(true);
        expect(player.attack).toBe(BOOSTED_STAT);
        expect(player.defense).toBe(BOOSTED_STAT);
        expect(player.combatSanctuaryPointsLeft).toBe(2);

        service.progressCombatSanctuaryEffect(player);
        service.advanceShrineCooldowns(session);
        expect(player.attack).toBe(BOOSTED_STAT);
        expect(player.defense).toBe(BOOSTED_STAT);
        expect(player.combatSanctuaryPointsLeft).toBe(1);
        expect(session.cells.find((cell) => cell.shrineId === 'shrine-2')?.shrineCooldownTurns).toBe(2);

        service.progressCombatSanctuaryEffect(player);
        service.advanceShrineCooldowns(session);
        service.advanceShrineCooldowns(session);
        expect(player.attack).toBe(BASE_STAT);
        expect(player.defense).toBe(BASE_STAT);
        expect(player.combatSanctuaryPointsLeft).toBe(0);
        expect(session.cells.find((cell) => cell.shrineId === 'shrine-2')?.shrineCooldownTurns).toBe(0);
    });

    it('rejects sanctuary usage when player is not adjacent or shrine is inactive', () => {
        const player = createPlayer('player-1', { position: { row: 4, column: 4 } });
        const session = createSession([player], [
            { row: 0, column: 0, tile: TileId.Base, object: ObjectId.Start },
            ...createShrineCells(ObjectId.Heal, 'shrine-3').map((cell) => ({ ...cell, shrineCooldownTurns: 1 })),
        ]);
        const hooks = createHooks();

        const used = service.tryUseSanctuary(session, player, { row: 0, column: 1 }, 'normal', hooks);
        const canUse = service.canUseSanctuaryOnCell(session, player, session.cells.find((cell) => cell.row === 0 && cell.column === 1));

        expect(used).toBe(false);
        expect(canUse).toBe(false);
        expect(hooks.appendMessage).not.toHaveBeenCalled();
    });
});


