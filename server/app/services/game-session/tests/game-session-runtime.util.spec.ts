import {
    createTestPlayer,
    createTestSession,
} from '@app/services/game-session/tests/game-session-sub-services.spec.utils';
import { buildSystemMessage } from '@app/services/game-session/utils/game-session-message.factory';
import {
    appendSessionMessage,
    canCloseDoor,
    dropFlagOnDefeatTile,
    teleportToSpawn,
    tryToggleDoor,
    updateVisitedTiles,
} from '@app/services/game-session/utils/game-session-runtime.util';
import { DoorState, Mode, ObjectId, TileId } from '@common/game';

/**
 * Portee :
 * - effets de bord des utilitaires runtime sur l'état session/joueur
 * Cas limites :
 * - contraintes de bascule de porte en CTF
 * - repli vers le point libre valide le plus proche pour la téléportation
 * - comportement de chute du drapeau sur la case de defaite
 */
/**
 * Strategie :
 * - tester game-session-runtime.util sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('game-session-runtime.util', () => {
    it('appends a session message immutably', () => {
        const player = createTestPlayer('player-1');
        const session = createTestSession([player]);
        const previousMessages = session.messages;
        const message = buildSystemMessage('Nouveau message');

        appendSessionMessage(session, message);

        expect(session.messages).toHaveLength(1);
        expect(session.messages[0].text).toBe('Nouveau message');
        expect(session.messages).not.toBe(previousMessages);
    });

    it('tracks visited tiles only once', () => {
        const player = createTestPlayer('player-1', { position: { row: 1, column: 2 } });

        updateVisitedTiles(player);
        updateVisitedTiles(player);

        expect(player.visitedTiles).toEqual(['1,2']);
    });

    it('allows closing a door only when unoccupied and not CTF flag door', () => {
        const players = [createTestPlayer('player-1', { position: { row: 0, column: 0 } })];
        const session = createTestSession(players, {}, [
            { row: 0, column: 0, tile: TileId.Base },
            { row: 0, column: 1, tile: TileId.Door, doorState: DoorState.Open },
        ]);
        const freeDoorCell = session.cells[1];

        expect(canCloseDoor(session, freeDoorCell, Mode.Classic)).toBe(true);

        players.push(createTestPlayer('player-2', { position: { row: 0, column: 1 } }));
        expect(canCloseDoor(session, freeDoorCell, Mode.Classic)).toBe(false);

        players.pop();
        freeDoorCell.object = ObjectId.Flag;
        expect(canCloseDoor(session, freeDoorCell, Mode.CTF)).toBe(false);
    });

    it('toggles an adjacent door and logs the action', () => {
        const activePlayer = createTestPlayer('player-1', { name: 'Alpha', position: { row: 0, column: 0 } });
        const session = createTestSession([activePlayer], {}, [
            { row: 0, column: 0, tile: TileId.Base },
            { row: 0, column: 1, tile: TileId.Door, doorState: DoorState.Closed },
        ]);

        const changed = tryToggleDoor(session, activePlayer, { row: 0, column: 1 }, Mode.Classic);

        expect(changed).toBe(true);
        expect(session.cells[1].doorState).toBe(DoorState.Open);
        expect(session.cells[1].doorManipulated).toBe(true);
        expect(session.messages.at(-1)?.text).toContain('ouvre une porte');
    });

    it('teleports to nearest free non-blocked cell around spawn', () => {
        const player = createTestPlayer('player-1', { position: { row: 9, column: 9 } });
        const occupied = createTestPlayer('player-2', { position: { row: 0, column: 0 } });
        const session = createTestSession([player, occupied], {}, [
            { row: 0, column: 0, tile: TileId.Base },
            { row: 0, column: 1, tile: TileId.Base },
            { row: 1, column: 0, tile: TileId.Wall },
            { row: 1, column: 1, tile: TileId.Base },
        ]);

        teleportToSpawn(session, player, { row: 0, column: 0 });

        expect(player.position).toEqual({ row: 0, column: 1 });
    });

    it('drops the flag on the defeat tile when it is already valid', () => {
        const defeatedPlayer = createTestPlayer('player-1', {
            name: 'Porteur',
            hasFlag: true,
            position: { row: 2, column: 2 },
        });
        const session = createTestSession([defeatedPlayer], {}, [
            { row: 2, column: 2, tile: TileId.Base },
            { row: 2, column: 1, tile: TileId.Base },
        ]);

        dropFlagOnDefeatTile(session, defeatedPlayer);

        expect(defeatedPlayer.hasFlag).toBe(false);
        expect(session.cells.find((cell) => cell.row === 2 && cell.column === 2)?.object).toBe(ObjectId.Flag);
        expect(session.messages.at(-1)?.eventType).toBe('flag');
        expect(session.messages.at(-1)?.text).toContain('a laisse tomber le drapeau');
    });

    it('drops the flag on the nearest free terrain tile when the defeat tile is invalid', () => {
        const defeatedPlayer = createTestPlayer('player-1', {
            name: 'Porteur',
            hasFlag: true,
            position: { row: 2, column: 2 },
        });
        const occupant = createTestPlayer('player-2', {
            position: { row: 2, column: 2 },
        });
        const session = createTestSession([defeatedPlayer, occupant], {}, [
            { row: 2, column: 2, tile: TileId.Door, doorState: DoorState.Open },
            { row: 2, column: 1, tile: TileId.Wall },
            { row: 2, column: 3, tile: TileId.Base, object: ObjectId.Heal },
            { row: 1, column: 2, tile: TileId.Base },
            { row: 3, column: 2, tile: TileId.Water },
        ]);

        dropFlagOnDefeatTile(session, defeatedPlayer);

        expect(defeatedPlayer.hasFlag).toBe(false);
        expect(session.cells.find((cell) => cell.row === 1 && cell.column === 2)?.object).toBe(ObjectId.Flag);
        expect(session.messages.at(-1)?.eventType).toBe('flag');
        expect(session.messages.at(-1)?.text).toContain('a laisse tomber le drapeau');
    });
});
