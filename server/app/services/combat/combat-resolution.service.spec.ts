import { CombatPosture, ICE_TILE_COMBAT_PENALTY } from '@common/combat';
import { GridSize, TileId } from '@common/game';
import { GameSessionPlayer, GameSessionState } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';
import { CombatResolutionService } from './combat-resolution.service';

const INITIAL_HEALTH = 10;
const ATTACKER_WIN_ATTACK_TOTAL = 10;
const ATTACKER_WIN_DEFENSE_TOTAL = 5;
const ATTACKER_WIN_DAMAGE = 5;
const EQUAL_TOTAL = 5;
const DEFENSIVE_TOTAL = 7;
const SIM_ATTACKER_ATTACK_TOTAL = 12;
const SIM_ATTACKER_DEFENSE_TOTAL = 4;
const SIM_DEFENDER_ATTACK_TOTAL = 11;
const SIM_DEFENDER_DEFENSE_TOTAL = 3;
const SIM_DAMAGE = 8;
const SIM_HEALTH_AFTER = 2;
const DICE_HIGH = 4;
const DICE_LOW = 1;
const ATTACKER_ID = 'attacker';
const DEFENDER_ID = 'defender';
const ATTACKER_POSITION = { row: 0, column: 0 };
const DEFENDER_POSITION = { row: 0, column: 1 };
const BASE_STAT = 4;
const LOW_STAT = 2;
const HIGH_ATTACK_STAT = 6;
const MEDIUM_ATTACK_STAT = 5;
const MEDIUM_DEFENSE_STAT = 3;
const TEN_HEALTH = 10;
const MIN_DICE_ROLL = 1;
const NO_DAMAGE = 0;
const ICE_PENALIZED_TOTAL = 3;

function createPlayer(overrides: Partial<GameSessionPlayer>): GameSessionPlayer {
    return {
        id: 'player',
        name: 'Player',
        avatar: {
            avatarName: AvatarName.Barbie,
            imageUrl: 'assets/characters/barbie.png',
        },
        playerType: PlayerType.HumanPlayer,
        maxHealth: 10,
        health: INITIAL_HEALTH,
        speed: 4,
        attack: 4,
        defense: 4,
        attackDice: 'D4',
        defenseDice: 'D4',
        movementPointsLeft: 4,
        combatSanctuaryPointsLeft: 0,
        actionsLeft: 1,
        combatsWon: 0,
        turnOrder: 1,
        isHost: false,
        hasAbandoned: false,
        position: { row: 0, column: 0 },
        ...overrides,
    };
}

function createSession(attacker: GameSessionPlayer, defender: GameSessionPlayer): GameSessionState {
    return {
        sessionId: 'ROOM01',
        roomId: 'ROOM01',
        gameId: 'game-1',
        gridSize: GridSize.Small,
        cells: [
            { row: attacker.position.row, column: attacker.position.column, tile: TileId.Base },
            { row: defender.position.row, column: defender.position.column, tile: TileId.Base },
        ],
        players: [attacker, defender],
        activePlayerId: attacker.id,
        phase: 'turn',
        countdownMode: 'combat',
        countdownCombatPlayerIds: [attacker.id, defender.id],
        turnRemainingSeconds: 10,
        debugMode: false,
        combatState: {
            attackerId: attacker.id,
            defenderId: defender.id,
            currentTurnNumber: 1,
            turnsHistory: [],
        },
        messages: [],
    };
}

/**
 * Strategie :
 * - tester CombatResolutionService sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('CombatResolutionService', () => {
    let service: CombatResolutionService;

    beforeEach(() => {
        service = new CombatResolutionService();
    });

    it('returns max or min dice value in debug mode depending on instigator status', () => {
        expect(service.rollDice('D4', true, true)).toBe(4);
        expect(service.rollDice('D4', true, false)).toBe(1);
    });

    it('rolls within normal random bounds when debug mode is disabled', () => {
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.999999);

        expect(service.rollDice('D4', false, true)).toBe(1);
        expect(service.rollDice('D4', false, true)).toBe(4);

        randomSpy.mockRestore();
    });

    it('returns posture bonus only for matching posture and attribute pairs', () => {
        expect(service.getPostureBonus(CombatPosture.Offensive, 'attack')).toBe(2);
        expect(service.getPostureBonus(CombatPosture.Offensive, 'defense')).toBe(0);
        expect(service.getPostureBonus(CombatPosture.Defensive, 'defense')).toBe(2);
        expect(service.getPostureBonus(CombatPosture.Defensive, 'attack')).toBe(0);
        expect(service.getPostureBonus(CombatPosture.Neutral, 'attack')).toBe(0);
    });

    it('returns zero terrain penalty when player or player cell is missing', () => {
        const attacker = createPlayer({ id: ATTACKER_ID, position: ATTACKER_POSITION });
        const defender = createPlayer({ id: DEFENDER_ID, position: DEFENDER_POSITION });
        const session = createSession(attacker, defender);

        expect(service.getTerrainPenalty(session, 'missing-player')).toBe(0);

        attacker.position = { row: 99, column: 99 };
        expect(service.getTerrainPenalty(session, ATTACKER_ID)).toBe(0);
    });

    it('applies formula and deals damage when attack total is strictly greater than defense total', () => {
        const attacker = createPlayer({ id: ATTACKER_ID, attack: BASE_STAT, defense: LOW_STAT, position: ATTACKER_POSITION });
        const defender = createPlayer({ id: DEFENDER_ID, attack: LOW_STAT, defense: BASE_STAT, position: DEFENDER_POSITION });
        const session = createSession(attacker, defender);
        jest.spyOn(service, 'rollDice').mockReturnValueOnce(DICE_HIGH).mockReturnValueOnce(DICE_LOW);

        const result = service.resolveCombatTurn(session, attacker, defender, CombatPosture.Offensive, CombatPosture.Neutral);

        expect(result.attackerAttackTotal).toBe(ATTACKER_WIN_ATTACK_TOTAL);
        expect(result.defenderDefenseTotal).toBe(ATTACKER_WIN_DEFENSE_TOTAL);
        expect(result.damageDealt).toBe(ATTACKER_WIN_DAMAGE);
        expect(result.defenderHealthAfter).toBe(ATTACKER_WIN_DAMAGE);
    });

    it('does not deal damage when totals are equal', () => {
        const attacker = createPlayer({ id: ATTACKER_ID, attack: BASE_STAT, defense: LOW_STAT, position: ATTACKER_POSITION });
        const defender = createPlayer({ id: DEFENDER_ID, attack: LOW_STAT, defense: BASE_STAT, position: DEFENDER_POSITION });
        const session = createSession(attacker, defender);
        jest.spyOn(service, 'rollDice').mockReturnValueOnce(MIN_DICE_ROLL).mockReturnValueOnce(MIN_DICE_ROLL);

        const result = service.resolveCombatTurn(session, attacker, defender, CombatPosture.Neutral, CombatPosture.Neutral);

        expect(result.attackerAttackTotal).toBe(EQUAL_TOTAL);
        expect(result.defenderDefenseTotal).toBe(EQUAL_TOTAL);
        expect(result.damageDealt).toBe(NO_DAMAGE);
        expect(result.defenderHealthAfter).toBe(INITIAL_HEALTH);
    });

    it('applies defensive posture bonus to defense only', () => {
        const attacker = createPlayer({ id: ATTACKER_ID, attack: MEDIUM_ATTACK_STAT, defense: LOW_STAT, position: ATTACKER_POSITION });
        const defender = createPlayer({ id: DEFENDER_ID, attack: LOW_STAT, defense: BASE_STAT, position: DEFENDER_POSITION });
        const session = createSession(attacker, defender);
        jest.spyOn(service, 'rollDice').mockReturnValueOnce(MIN_DICE_ROLL).mockReturnValueOnce(MIN_DICE_ROLL);

        const result = service.resolveCombatTurn(session, attacker, defender, CombatPosture.Neutral, CombatPosture.Defensive);

        expect(result.defenderDefensePostureBonus).toBe(2);
        expect(result.defenderDefenseTotal).toBe(DEFENSIVE_TOTAL);
        expect(result.damageDealt).toBe(NO_DAMAGE);
    });

    it('computes both attacks simultaneously at round resolution', () => {
        const attacker = createPlayer({
            id: ATTACKER_ID,
            attack: HIGH_ATTACK_STAT,
            defense: LOW_STAT,
            health: TEN_HEALTH,
            position: ATTACKER_POSITION,
        });
        const defender = createPlayer({
            id: DEFENDER_ID,
            attack: MEDIUM_ATTACK_STAT,
            defense: MEDIUM_DEFENSE_STAT,
            health: TEN_HEALTH,
            position: DEFENDER_POSITION,
        });
        const session = createSession(attacker, defender);

        jest.spyOn(service, 'rollDice')
            .mockReturnValueOnce(DICE_HIGH)
            .mockReturnValueOnce(DICE_LOW)
            .mockReturnValueOnce(DICE_HIGH)
            .mockReturnValueOnce(DICE_LOW);

        const result = service.resolveCombatTurnSimultaneous(session, attacker, defender, CombatPosture.Offensive, CombatPosture.Offensive);

        expect(result.attackerToDefender.attackerAttackTotal).toBe(SIM_ATTACKER_ATTACK_TOTAL);
        expect(result.attackerToDefender.defenderDefenseTotal).toBe(SIM_ATTACKER_DEFENSE_TOTAL);
        expect(result.damageToDefender).toBe(SIM_DAMAGE);

        expect(result.defenderToAttacker.attackerAttackTotal).toBe(SIM_DEFENDER_ATTACK_TOTAL);
        expect(result.defenderToAttacker.defenderDefenseTotal).toBe(SIM_DEFENDER_DEFENSE_TOTAL);
        expect(result.damageToAttacker).toBe(SIM_DAMAGE);

        expect(result.defenderHealthAfter).toBe(SIM_HEALTH_AFTER);
        expect(result.attackerHealthAfter).toBe(SIM_HEALTH_AFTER);
    });

    it('applies ice penalty to attack and defense totals in resolveCombatTurn', () => {
        const attacker = createPlayer({ id: ATTACKER_ID, attack: BASE_STAT, defense: BASE_STAT, position: ATTACKER_POSITION });
        const defender = createPlayer({ id: DEFENDER_ID, attack: BASE_STAT, defense: BASE_STAT, position: DEFENDER_POSITION });
        const session = createSession(attacker, defender);

        session.cells[0].tile = TileId.Ice;
        session.cells[1].tile = TileId.Ice;

        jest.spyOn(service, 'rollDice').mockReturnValueOnce(MIN_DICE_ROLL).mockReturnValueOnce(MIN_DICE_ROLL);

        const result = service.resolveCombatTurn(session, attacker, defender, CombatPosture.Neutral, CombatPosture.Neutral);

        expect(result.attackerAttackPenalty).toBe(ICE_TILE_COMBAT_PENALTY);
        expect(result.defenderDefensePenalty).toBe(ICE_TILE_COMBAT_PENALTY);
        expect(result.attackerAttackTotal).toBe(ICE_PENALIZED_TOTAL);
        expect(result.defenderDefenseTotal).toBe(ICE_PENALIZED_TOTAL);
        expect(result.damageDealt).toBe(NO_DAMAGE);
    });

    it('applies ice penalty to both players in simultaneous round resolution', () => {
        const attacker = createPlayer({
            id: ATTACKER_ID,
            attack: BASE_STAT,
            defense: BASE_STAT,
            health: TEN_HEALTH,
            position: ATTACKER_POSITION,
        });
        const defender = createPlayer({
            id: DEFENDER_ID,
            attack: BASE_STAT,
            defense: BASE_STAT,
            health: TEN_HEALTH,
            position: DEFENDER_POSITION,
        });
        const session = createSession(attacker, defender);

        session.cells[0].tile = TileId.Ice;
        session.cells[1].tile = TileId.Ice;

        jest.spyOn(service, 'rollDice').mockReturnValue(MIN_DICE_ROLL);

        const result = service.resolveCombatTurnSimultaneous(session, attacker, defender, CombatPosture.Neutral, CombatPosture.Neutral);

        expect(result.attackerToDefender.attackerAttackPenalty).toBe(ICE_TILE_COMBAT_PENALTY);
        expect(result.attackerToDefender.defenderDefensePenalty).toBe(ICE_TILE_COMBAT_PENALTY);
        expect(result.defenderToAttacker.attackerAttackPenalty).toBe(ICE_TILE_COMBAT_PENALTY);
        expect(result.defenderToAttacker.defenderDefensePenalty).toBe(ICE_TILE_COMBAT_PENALTY);
        expect(result.attackerToDefender.attackerAttackTotal).toBe(ICE_PENALIZED_TOTAL);
        expect(result.attackerToDefender.defenderDefenseTotal).toBe(ICE_PENALIZED_TOTAL);
        expect(result.defenderToAttacker.attackerAttackTotal).toBe(ICE_PENALIZED_TOTAL);
        expect(result.defenderToAttacker.defenderDefenseTotal).toBe(ICE_PENALIZED_TOTAL);
        expect(result.damageToDefender).toBe(NO_DAMAGE);
        expect(result.damageToAttacker).toBe(NO_DAMAGE);
    });
});
