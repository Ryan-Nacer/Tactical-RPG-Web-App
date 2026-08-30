import { PendingFlagTransfer } from '@app/services/game-session/sub-services/game-session-ctf.service';
import { GameSessionHooksFactoryService } from '@app/services/game-session/sub-services/game-session-hooks-factory.service';
import { createTestPlayer, createTestSession } from '@app/services/game-session/tests/game-session-sub-services.spec.utils';
import { Mode } from '@common/game';

const createDependencies = () => {
    const combatService = {
        resolveCombatRound: jest.fn(),
        endCombat: jest.fn(),
    };

    const ctfService = {
        expirePendingTransfer: jest.fn(),
    };

    const turnService = {
        completeTurn: jest.fn(),
        startTransitionToNextTurn: jest.fn(),
    };

    const getMode = jest.fn((roomId: string) => (roomId ? Mode.CTF : Mode.Classic));
    const getSpawnPosition = jest.fn((playerId: string) => (playerId ? { row: 0, column: 0 } : { row: 1, column: 1 }));
    const emitSessionUpdate = jest.fn();
    const removeSession = jest.fn();
    const emitCombatEnd = jest.fn();

    const pendingTransfers = new Map<string, PendingFlagTransfer>();
    const hasPendingTransfer = jest.fn((roomId: string) => pendingTransfers.has(roomId));
    const setPendingTransfer = jest.fn((roomId: string, transfer: PendingFlagTransfer) => {
        pendingTransfers.set(roomId, transfer);
    });
    const clearPendingTransfer = jest.fn((roomId: string) => {
        pendingTransfers.delete(roomId);
    });

    const dependencies = {
        combatService: combatService as never,
        ctfService: ctfService as never,
        turnService: turnService as never,
        getMode,
        getSpawnPosition,
        emitSessionUpdate,
        removeSession,
        emitCombatEnd,
        hasPendingTransfer,
        getPendingTransfer: jest.fn((roomId: string) => pendingTransfers.get(roomId)),
        setPendingTransfer,
        clearPendingTransfer,
    };

    return {
        dependencies,
        spies: {
            combatService,
            ctfService,
            turnService,
            getMode,
            getSpawnPosition,
            emitSessionUpdate,
            removeSession,
            emitCombatEnd,
            hasPendingTransfer,
            getPendingTransfer: dependencies.getPendingTransfer,
            setPendingTransfer,
            clearPendingTransfer,
        },
        pendingTransfers,
    };
};

/**
 * Portee :
 * - assemblage des hooks uniquement (sans decision de regle metier)
 * Cas limites :
 * - comportement de proxy des transferts en attente
 * - delegation vers les dependances combat/tour
 * - relais de la résolution mode/spawn
 */
/**
 * Strategie :
 * - tester GameSessionHooksFactoryService sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('GameSessionHooksFactoryService', () => {
    it('builds player action hooks that expose mode and emit updates', () => {
        const { dependencies, spies } = createDependencies();
        const service = new GameSessionHooksFactoryService(dependencies);
        const hooks = service.createPlayerActionHooks();
        const session = createTestSession([createTestPlayer('player-1'), createTestPlayer('player-2')]);

        expect(hooks.getMode('ROOM01')).toBe(Mode.CTF);
        hooks.emitSessionUpdate('ROOM01', session);

        expect(spies.getMode).toHaveBeenCalledWith('ROOM01');
        expect(spies.emitSessionUpdate).toHaveBeenCalledWith('ROOM01', session);
        expect(hooks.getCombatHooks()).toBeDefined();
        expect(hooks.getCtfHooks()).toBeDefined();
        expect(hooks.getTurnHooks()).toBeDefined();
        expect(hooks.getSanctuaryHooks()).toBeDefined();
    });

    it('builds CTF hooks that proxy pending-transfer operations', () => {
        const { dependencies, spies, pendingTransfers } = createDependencies();
        const service = new GameSessionHooksFactoryService(dependencies);
        const hooks = service.createCtfHooks();
        const transfer: PendingFlagTransfer = {
            initiatorId: 'player-1',
            teammateId: 'player-2',
            target: { row: 1, column: 1 },
        };

        hooks.setPendingTransfer('ROOM01', transfer);
        expect(hooks.hasPendingTransfer('ROOM01')).toBe(true);
        hooks.clearPendingTransfer('ROOM01');

        hooks.removeSession('ROOM01');

        expect(spies.setPendingTransfer).toHaveBeenCalledWith('ROOM01', transfer);
        expect(spies.hasPendingTransfer).toHaveBeenCalledWith('ROOM01');
        expect(spies.clearPendingTransfer).toHaveBeenCalledWith('ROOM01');
        expect(spies.removeSession).toHaveBeenCalledWith('ROOM01');
        expect(pendingTransfers.has('ROOM01')).toBe(false);
    });

    it('builds turn hooks that delegate combat résolution and pending transfer expiry', () => {
        const { dependencies, spies } = createDependencies();
        const service = new GameSessionHooksFactoryService(dependencies);
        const hooks = service.createTurnHooks();
        const session = createTestSession([createTestPlayer('player-1'), createTestPlayer('player-2')]);

        hooks.resolveCombatRound(session);
        hooks.endCombat(session);
        hooks.expirePendingTransfer(session);

        expect(spies.combatService.resolveCombatRound).toHaveBeenCalled();
        expect(spies.combatService.endCombat).toHaveBeenCalledWith(session);
        expect(spies.getPendingTransfer).toHaveBeenCalledWith('ROOM01');
        expect(spies.ctfService.expirePendingTransfer).toHaveBeenCalled();
    });

    it('builds combat hooks that delegate mode lookup, combat end and complete turn', () => {
        const { dependencies, spies } = createDependencies();
        const service = new GameSessionHooksFactoryService(dependencies);
        const hooks = service.createCombatHooks();
        const session = createTestSession([createTestPlayer('player-1'), createTestPlayer('player-2')]);
        const player = session.players[0];

        const mode = hooks.getMode('ROOM01');
        hooks.emitCombatEnd({ roomId: 'ROOM01' } as never);
        hooks.completeTurn(session, player);

        expect(mode).toBe(Mode.CTF);
        expect(spies.getMode).toHaveBeenCalledWith('ROOM01');
        expect(spies.emitCombatEnd).toHaveBeenCalledWith({ roomId: 'ROOM01' });
        expect(spies.turnService.completeTurn).toHaveBeenCalledWith(
            session,
            player,
            expect.objectContaining({
                canCloseDoor: expect.any(Function),
                resolveCombatRound: expect.any(Function),
                endCombat: expect.any(Function),
                expirePendingTransfer: expect.any(Function),
                appendMessage: expect.any(Function),
            }),
        );
    });

    it('builds abandon hooks that delegate transition and combat end', () => {
        const { dependencies, spies } = createDependencies();
        const service = new GameSessionHooksFactoryService(dependencies);
        const hooks = service.createAbandonHooks();
        const session = createTestSession([createTestPlayer('player-1'), createTestPlayer('player-2')]);
        const player = session.players[0];

        hooks.startTransitionToNextTurn(session);
        hooks.endCombat(session);
        hooks.emitCombatEnd({ roomId: 'ROOM01' } as never);
        hooks.teleportToSpawn(session, player);

        expect(spies.turnService.startTransitionToNextTurn).toHaveBeenCalledWith(session);
        expect(spies.combatService.endCombat).toHaveBeenCalledWith(session);
        expect(spies.emitCombatEnd).toHaveBeenCalledWith({ roomId: 'ROOM01' });
        expect(spies.getSpawnPosition).toHaveBeenCalledWith(player.id);
    });
});
