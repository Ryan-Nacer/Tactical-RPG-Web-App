import { DoorState, ObjectId, TileId } from '@common/game';
import { GameSessionState, GridPosition } from '@common/game-session';
import {
    canVirtualPlayerUseHealSanctuaryAt,
    getSessionCellAt,
    isCellBlockedOnVirtualPlayerPath,
    isOccupiedByAnotherPlayer,
} from './strategy-board.helper';

describe('strategy-board.helper', () => {
    const position: GridPosition = { row: 0, column: 0 };
    const minimalSession = {
        cells: [{ row: 0, column: 0, tile: TileId.Base }],
        players: [
            {
                id: 'p1',
                hasAbandoned: false,
                position: { row: 1, column: 0 },
            },
        ],
    } as unknown as GameSessionState;

    it('getSessionCellAt returns the matching cell', () => {
        expect(getSessionCellAt(minimalSession, position)).toEqual(minimalSession.cells[0]);
    });

    it('isCellBlockedOnVirtualPlayerPath returns true for a wall', () => {
        expect(isCellBlockedOnVirtualPlayerPath({ row: 0, column: 0, tile: TileId.Wall })).toBe(true);
    });

    it('isCellBlockedOnVirtualPlayerPath returns true for a closed door', () => {
        expect(
            isCellBlockedOnVirtualPlayerPath({
                row: 0,
                column: 0,
                tile: TileId.Door,
                doorState: DoorState.Closed,
            }),
        ).toBe(true);
    });

    it('isCellBlockedOnVirtualPlayerPath returns false for metadata-only shrine tiles', () => {
        expect(
            isCellBlockedOnVirtualPlayerPath({
                row: 0,
                column: 0,
                tile: TileId.Base,
                shrineId: 'shrine-1',
            }),
        ).toBe(false);
    });

    it('isOccupiedByAnotherPlayer detects another player on the tile', () => {
        expect(isOccupiedByAnotherPlayer(minimalSession, { row: 1, column: 0 }, 'p2')).toBe(true);
        expect(isOccupiedByAnotherPlayer(minimalSession, { row: 1, column: 0 }, 'p1')).toBe(false);
    });

    it('canVirtualPlayerUseHealSanctuaryAt rejects an inactive shrine', () => {
        const player = {
            id: 'vp',
            hasAbandoned: false,
            position: { row: 0, column: 0 },
        };
        const session = {
            cells: [
                { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Heal, shrineId: 's1', shrineCooldownTurns: 2 },
                { row: 0, column: 0, tile: TileId.Base },
            ],
            players: [player],
        } as unknown as GameSessionState;

        expect(canVirtualPlayerUseHealSanctuaryAt(session, player as never, { row: 0, column: 1 })).toBe(false);
    });

    it('canVirtualPlayerUseHealSanctuaryAt accepts an active adjacent heal shrine', () => {
        const player = {
            id: 'vp',
            hasAbandoned: false,
            position: { row: 0, column: 0 },
        };
        const session = {
            cells: [
                { row: 0, column: 1, tile: TileId.Base, object: ObjectId.Heal, shrineId: 's1', shrineCooldownTurns: 0 },
                { row: 0, column: 0, tile: TileId.Base },
            ],
            players: [player],
        } as unknown as GameSessionState;

        expect(canVirtualPlayerUseHealSanctuaryAt(session, player as never, { row: 0, column: 1 })).toBe(true);
    });
});
