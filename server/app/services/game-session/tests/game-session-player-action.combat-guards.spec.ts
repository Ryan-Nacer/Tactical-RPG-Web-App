import { GameSessionCombatHooks, GameSessionCombatService } from '@app/services/game-session/sub-services/game-session-combat.service';
import { GameSessionCtfHooks, GameSessionCtfService } from '@app/services/game-session/sub-services/game-session-ctf.service';
import { GameSessionPlayerActionHooks, GameSessionPlayerActionService } from '@app/services/game-session/sub-services/game-session-player-action.service';
import { GameSessionSanctuaryHooks, GameSessionSanctuaryService } from '@app/services/game-session/sub-services/game-session-sanctuary.service';
import { createTestPlayer, createTestSession } from '@app/services/game-session/tests/game-session-sub-services.spec.utils';
import { GameSessionTurnHooks, GameSessionTurnService } from '@app/services/game-session/utils/game-session-turn.service';
import { PlayerService } from '@app/services/player/player.service';
import { CombatPosture } from '@common/combat';
import { Mode } from '@common/game';
import { GameSessionState } from '@common/game-session';

type PlayerServiceMock = Pick<PlayerService, 'tryPerformCombatAction'>;
type CombatServiceMock = {
    startCombat: jest.Mock;
    resolveCombatRound: jest.Mock;
};
type CtfServiceMock = {
    tryExchangeFlagWithTeammate: jest.Mock;
    canTriggerCombatBetween: jest.Mock;
    tryPickUpFlag: jest.Mock;
    checkCtfWinCondition: jest.Mock;
};
type SanctuaryServiceMock = {
    tryUseSanctuary: jest.Mock;
};
type TurnServiceMock = {
    completeTurnIfNoOptions: jest.Mock;
};

type HooksWithSpies = GameSessionPlayerActionHooks & {
    emitSessionUpdate: jest.Mock;
    getMode: jest.Mock;
};

/**
 * Strategie :
 * - tester les gardes de combat de GameSessionPlayerActionService (declenchement et posture)
 * - couvrir surtout les refus CTF allies et les cas de posture invalide
 * - verifier les effets observables (messages, emissions, appels de services)
 */
describe('GameSessionPlayerActionService combat guards', () => {
    let service: GameSessionPlayerActionService;
    let playerServiceMock: PlayerServiceMock;
    let combatServiceMock: CombatServiceMock;
    let ctfServiceMock: CtfServiceMock;
    let sanctuaryServiceMock: SanctuaryServiceMock;
    let turnServiceMock: TurnServiceMock;

    const createHooks = (mode: Mode = Mode.CTF): HooksWithSpies =>
        ({
            getMode: jest.fn().mockReturnValue(mode),
            getCombatHooks: jest.fn().mockReturnValue({} as GameSessionCombatHooks),
            getCtfHooks: jest.fn().mockReturnValue({} as GameSessionCtfHooks),
            getTurnHooks: jest.fn().mockReturnValue({} as GameSessionTurnHooks),
            getSanctuaryHooks: jest.fn().mockReturnValue({} as GameSessionSanctuaryHooks),
            emitSessionUpdate: jest.fn(),
        }) as HooksWithSpies;

    const createCombatSession = (): GameSessionState => {
        const attacker = createTestPlayer('player-1', { position: { row: 0, column: 0 }, actionsLeft: 1 });
        const defender = createTestPlayer('player-2', { position: { row: 0, column: 1 } });
        return createTestSession([attacker, defender], {
            activePlayerId: 'player-1',
            phase: 'turn',
            countdownMode: 'turn',
        });
    };

    beforeEach(() => {
        playerServiceMock = {
            tryPerformCombatAction: jest.fn(),
        };
        combatServiceMock = {
            startCombat: jest.fn(),
            resolveCombatRound: jest.fn(),
        };
        ctfServiceMock = {
            tryExchangeFlagWithTeammate: jest.fn().mockReturnValue(false),
            canTriggerCombatBetween: jest.fn().mockReturnValue(true),
            tryPickUpFlag: jest.fn(),
            checkCtfWinCondition: jest.fn().mockReturnValue(false),
        };
        sanctuaryServiceMock = {
            tryUseSanctuary: jest.fn().mockReturnValue(false),
        };
        turnServiceMock = {
            completeTurnIfNoOptions: jest.fn(),
        };

        service = new GameSessionPlayerActionService(
            playerServiceMock as unknown as PlayerService,
            combatServiceMock as unknown as GameSessionCombatService,
            ctfServiceMock as unknown as GameSessionCtfService,
            sanctuaryServiceMock as unknown as GameSessionSanctuaryService,
            turnServiceMock as unknown as GameSessionTurnService,
        );
    });

    it('rejects combat against an ally in CTF mode', () => {
        const session = createCombatSession();
        const hooks = createHooks(Mode.CTF);
        playerServiceMock.tryPerformCombatAction = jest.fn().mockReturnValue(session.players[1]);
        ctfServiceMock.canTriggerCombatBetween.mockReturnValue(false);

        service.performAction('ROOM01', 'player-1', { row: 0, column: 1 }, session, hooks);

        expect(combatServiceMock.startCombat).not.toHaveBeenCalled();
        expect(session.players[0].actionsLeft).toBe(1);
        expect(session.messages.at(-1)?.text).toContain('Impossible de lancer un combat contre un allie en mode CTF');
        expect(hooks.emitSessionUpdate).toHaveBeenCalledWith('ROOM01', session);
    });

    it('does not accept posture choice from a non combat participant', () => {
        const session = createCombatSession();
        const hooks = createHooks();
        session.countdownMode = 'combat';
        session.combatState = {
            attackerId: 'player-1',
            defenderId: 'player-2',
            currentTurnNumber: 1,
            turnsHistory: [],
        };

        service.chooseCombatPosture('ROOM01', 'player-3', CombatPosture.Offensive, session, hooks);

        expect(combatServiceMock.resolveCombatRound).not.toHaveBeenCalled();
        expect(hooks.emitSessionUpdate).not.toHaveBeenCalled();
        expect(session.combatState.attackerPosture).toBeUndefined();
        expect(session.combatState.defenderPosture).toBeUndefined();
    });

    it('does not accept posture choice when countdown mode is not combat', () => {
        const session = createCombatSession();
        const hooks = createHooks();
        session.countdownMode = 'turn';
        session.combatState = {
            attackerId: 'player-1',
            defenderId: 'player-2',
            currentTurnNumber: 1,
            turnsHistory: [],
        };

        service.chooseCombatPosture('ROOM01', 'player-1', CombatPosture.Offensive, session, hooks);

        expect(combatServiceMock.resolveCombatRound).not.toHaveBeenCalled();
        expect(hooks.emitSessionUpdate).not.toHaveBeenCalled();
        expect(session.combatState.attackerPosture).toBeUndefined();
    });

    it('resolves the round only when both combat postures are selected', () => {
        const session = createCombatSession();
        const hooks = createHooks();
        session.countdownMode = 'combat';
        session.combatState = {
            attackerId: 'player-1',
            defenderId: 'player-2',
            currentTurnNumber: 1,
            turnsHistory: [],
        };

        service.chooseCombatPosture('ROOM01', 'player-1', CombatPosture.Offensive, session, hooks);

        expect(session.combatState.attackerPosture).toBe(CombatPosture.Offensive);
        expect(combatServiceMock.resolveCombatRound).not.toHaveBeenCalled();

        service.chooseCombatPosture('ROOM01', 'player-2', CombatPosture.Defensive, session, hooks);

        expect(session.combatState.defenderPosture).toBe(CombatPosture.Defensive);
        expect(combatServiceMock.resolveCombatRound).toHaveBeenCalledTimes(1);
        expect(hooks.emitSessionUpdate).toHaveBeenCalledTimes(2);
    });
});
