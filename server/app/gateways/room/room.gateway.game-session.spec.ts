import { RoomGateway } from '@app/gateways/room/room.gateway';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { GameService } from '@app/services/game/game.service';
import { RoomService } from '@app/services/room/room.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player.service';
import { GridSize, TileId } from '@common/game';
import { GameSessionState } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';
import { RoomEvents, RoomState } from '@common/wait-room';
import { Server, Socket } from 'socket.io';

/**
 * Strategie :
 * - tester les gardes du RoomGateway pendant une partie active
 * - verifier surtout qui peut agir, dans quelle phase et sous quelles conditions
 *
 * Cas limites cibles :
 * - joueur non actif
 * - joueur sans actions ou sans points de deplacement
 * - transition de tour qui bloque certaines commandes
 * - activation du debug reservee a l'organisateur
 */
describe('RoomGateway game session events', () => {
    const roomId = 'ROOM01';
    const hostId = 'host-1';
    const activePlayerId = 'player-2';

    let gateway: RoomGateway;
    let roomService: jest.Mocked<Pick<RoomService, 'getRoom'>>;
    let gameService: jest.Mocked<Record<never, never>>;
    let gameSessionService: jest.Mocked<
        Pick<GameSessionService, 'getSession' | 'getPendingFlagTransfer' | 'endTurn' | 'movePlayer' | 'performAction' | 'teleportPlayer' | 'toggleDebugMode'>
    >;
    let virtualPlayerService: jest.Mocked<Pick<VirtualPlayerService, 'clearRoom' | 'configureRoom' | 'onGameStateUpdate'>>;

    const room: RoomState = {
        roomId,
        hostId,
        gameId: 'game-1',
        gameName: 'Test Game',
        maxPlayers: 2,
        isLocked: true,
        mode: 'CLASSIC',
        players: [
            {
                id: hostId,
                name: 'Host',
                avatar: { avatarName: AvatarName.Barbie, imageUrl: 'assets/barbie.png' },
                playerType: PlayerType.HumanPlayer,
                character: {
                    health: 6,
                    maxHealth: 6,
                    speed: 4,
                    attack: 4,
                    defense: 4,
                    attackDice: 'D4',
                    defenseDice: 'D6',
                    movementPointsLeft: 4,
                    combatSanctuaryPointsLeft: 0,
                    actionsLeft: 1,
                },
            },
            {
                id: activePlayerId,
                name: 'Guest',
                avatar: { avatarName: AvatarName.Ken, imageUrl: 'assets/ken.png' },
                playerType: PlayerType.HumanPlayer,
                character: {
                    health: 6,
                    maxHealth: 6,
                    speed: 4,
                    attack: 4,
                    defense: 4,
                    attackDice: 'D4',
                    defenseDice: 'D6',
                    movementPointsLeft: 4,
                    combatSanctuaryPointsLeft: 0,
                    actionsLeft: 1,
                },
            },
        ],
    };

    const session: GameSessionState = {
        sessionId: roomId,
        roomId,
        gameId: 'game-1',
        gridSize: GridSize.Small,
        cells: [
            { row: 0, column: 0, tile: TileId.Base },
            { row: 0, column: 1, tile: TileId.Base },
        ],
        players: [
            {
                id: hostId,
                name: 'Host',
                avatar: room.players[0].avatar,
                playerType: PlayerType.HumanPlayer,
                maxHealth: 6,
                health: 6,
                speed: 4,
                attack: 4,
                defense: 4,
                attackDice: 'D4',
                defenseDice: 'D6',
                movementPointsLeft: 4,
                combatSanctuaryPointsLeft: 0,
                actionsLeft: 1,
                combatsWon: 0,
                turnOrder: 1,
                isHost: true,
                hasAbandoned: false,
                position: { row: 0, column: 0 },
            },
            {
                id: activePlayerId,
                name: 'Guest',
                avatar: room.players[1].avatar,
                playerType: PlayerType.HumanPlayer,
                maxHealth: 6,
                health: 6,
                speed: 4,
                attack: 4,
                defense: 4,
                attackDice: 'D4',
                defenseDice: 'D6',
                movementPointsLeft: 4,
                combatSanctuaryPointsLeft: 0,
                actionsLeft: 1,
                combatsWon: 0,
                turnOrder: 2,
                isHost: false,
                hasAbandoned: false,
                position: { row: 0, column: 1 },
            },
        ],
        activePlayerId,
        phase: 'turn',
        countdownMode: 'turn',
        countdownCombatPlayerIds: [],
        turnRemainingSeconds: 30,
        debugMode: true,
        messages: [],
    };

    const createClient = (id: string): jest.Mocked<Pick<Socket, 'id' | 'emit'>> => ({
        id,
        emit: jest.fn(),
    });

    beforeEach(() => {
        roomService = {
            getRoom: jest.fn(),
        };
        gameService = {};
        gameSessionService = {
            getSession: jest.fn(),
            getPendingFlagTransfer: jest.fn(),
            endTurn: jest.fn(),
            movePlayer: jest.fn(),
            performAction: jest.fn(),
            teleportPlayer: jest.fn(),
            toggleDebugMode: jest.fn(),
        };
        virtualPlayerService = {
            clearRoom: jest.fn(),
            configureRoom: jest.fn(),
            onGameStateUpdate: jest.fn(),
        };

        gateway = new RoomGateway(
            roomService as unknown as RoomService,
            gameService as unknown as GameService,
            gameSessionService as unknown as GameSessionService,
            virtualPlayerService as unknown as VirtualPlayerService,
        );
        (gateway as unknown as { server: Server }).server = {} as Server;
    });

    it('allows the host to end the active player turn while debug mode is active', () => {
        const client = createClient(hostId);
        roomService.getRoom.mockReturnValue(room);
        gameSessionService.getSession.mockReturnValue(session);

        gateway.handleEndTurn({ roomId }, client as unknown as Socket);

        expect(gameSessionService.endTurn).toHaveBeenCalledWith(roomId, activePlayerId);
    });

    it('rejects end turn from a non-active non-host player', () => {
        const client = createClient('player-3');
        roomService.getRoom.mockReturnValue(room);
        gameSessionService.getSession.mockReturnValue(session);

        gateway.handleEndTurn({ roomId }, client as unknown as Socket);

        expect(gameSessionService.endTurn).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Seul le joueur actif peut terminer le tour.',
        });
    });

    it('teleports the active player when debug mode is active', () => {
        const client = createClient(activePlayerId);
        gameSessionService.getSession.mockReturnValue(session);

        gateway.handleTeleportPlayer({ roomId, row: 0, column: 0 }, client as unknown as Socket);

        expect(gameSessionService.teleportPlayer).toHaveBeenCalledWith(roomId, activePlayerId, {
            roomId,
            row: 0,
            column: 0,
        });
    });

    it('rejects teleportation when debug mode is inactive', () => {
        const client = createClient(activePlayerId);
        gameSessionService.getSession.mockReturnValue({ ...session, debugMode: false });

        gateway.handleTeleportPlayer({ roomId, row: 0, column: 0 }, client as unknown as Socket);

        expect(gameSessionService.teleportPlayer).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Le mode debogage doit etre actif pour se teleporter.',
        });
    });

    it('rejects an action from a non-active player', () => {
        const client = createClient('player-3');
        gameSessionService.getSession.mockReturnValue(session);

        gateway.handlePerformAction({ roomId, row: 0, column: 0 }, client as unknown as Socket);

        expect(gameSessionService.performAction).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Seul le joueur actif peut effectuer une action.',
        });
    });

    it('rejects an action when the active player has no actions left', () => {
        const client = createClient(activePlayerId);
        const exhaustedSession = {
            ...session,
            players: session.players.map((player) => (player.id === activePlayerId ? { ...player, actionsLeft: 0 } : player)),
        };
        gameSessionService.getSession.mockReturnValue(exhaustedSession);

        gateway.handlePerformAction({ roomId, row: 0, column: 0 }, client as unknown as Socket);

        expect(gameSessionService.performAction).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: "Le joueur actif n'a plus d'actions disponibles.",
        });
    });

    it('moves the active player during the turn phase', () => {
        const client = createClient(activePlayerId);
        gameSessionService.getSession.mockReturnValue(session);
        gameSessionService.getPendingFlagTransfer.mockReturnValue(undefined);

        gateway.handleMovePlayer({ roomId, row: 0, column: 0 }, client as unknown as Socket);

        expect(gameSessionService.movePlayer).toHaveBeenCalledWith(roomId, activePlayerId, {
            roomId,
            row: 0,
            column: 0,
        });
    });

    it('still forwards a move attempt when the active player has no movement points left', () => {
        const client = createClient(activePlayerId);
        const blockedSession = {
            ...session,
            players: session.players.map((player) => (player.id === activePlayerId ? { ...player, movementPointsLeft: 0 } : player)),
        };
        gameSessionService.getSession.mockReturnValue(blockedSession);
        gameSessionService.getPendingFlagTransfer.mockReturnValue(undefined);

        gateway.handleMovePlayer({ roomId, row: 0, column: 0 }, client as unknown as Socket);

        expect(gameSessionService.movePlayer).toHaveBeenCalledWith(roomId, activePlayerId, {
            roomId,
            row: 0,
            column: 0,
        });
        expect(client.emit).not.toHaveBeenCalled();
    });

    it('rejects movement during the transition phase', () => {
        const client = createClient(activePlayerId);
        gameSessionService.getSession.mockReturnValue({ ...session, phase: 'transition' });
        gameSessionService.getPendingFlagTransfer.mockReturnValue(undefined);

        gateway.handleMovePlayer({ roomId, row: 0, column: 0 }, client as unknown as Socket);

        expect(gameSessionService.movePlayer).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Impossible de se deplacer pendant la transition de tour.',
        });
    });

    it('rejects movement while a flag transfer request is pending for the active player', () => {
        const client = createClient(activePlayerId);
        gameSessionService.getSession.mockReturnValue(session);
        gameSessionService.getPendingFlagTransfer.mockReturnValue({
            initiatorId: activePlayerId,
            teammateId: hostId,
            target: { row: 0, column: 0 },
        });

        gateway.handleMovePlayer({ roomId, row: 0, column: 0 }, client as unknown as Socket);

        expect(gameSessionService.movePlayer).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Impossible de se deplacer pendant une demande de transfert du drapeau.',
        });
    });

    it('allows the host to toggle debug mode', () => {
        const client = createClient(hostId);
        roomService.getRoom.mockReturnValue(room);
        gameSessionService.toggleDebugMode.mockReturnValue({ ...session, debugMode: false });

        gateway.handleToggleDebug({ roomId }, client as unknown as Socket);

        expect(gameSessionService.toggleDebugMode).toHaveBeenCalledWith(roomId);
        expect(client.emit).not.toHaveBeenCalled();
    });

    it('rejects debug toggling from a non-host player', () => {
        const client = createClient(activePlayerId);
        roomService.getRoom.mockReturnValue(room);

        gateway.handleToggleDebug({ roomId }, client as unknown as Socket);

        expect(gameSessionService.toggleDebugMode).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: "Seul l'organisateur peut activer le mode debug.",
        });
    });

    it('rejects debug toggling when the session is missing', () => {
        const client = createClient(hostId);
        roomService.getRoom.mockReturnValue(room);
        gameSessionService.toggleDebugMode.mockReturnValue(null);

        gateway.handleToggleDebug({ roomId }, client as unknown as Socket);

        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Session de jeu introuvable.',
        });
    });
});
