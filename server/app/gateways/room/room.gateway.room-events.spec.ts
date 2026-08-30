import { RoomGateway } from '@app/gateways/room/room.gateway';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { GameService } from '@app/services/game/game.service';
import { RoomService } from '@app/services/room/room.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player.service';
import { GridSize, Mode } from '@common/game';
import { GameSessionEvents, GameSessionState } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';
import {
    AddVirtualPlayerPayload,
    CreateRoomPayload,
    JoinableRoomSummary,
    Playstyle,
    PlayerCharacter,
    RoomEvents,
    RoomState,
} from '@common/wait-room';
import { Server, Socket } from 'socket.io';

/**
 * Strategie :
 * - tester uniquement le flux socket de jonction a une salle pour la validation logicielle
 * - verifier la synchronisation du client qui rejoint, de l'etat de salle et de la liste joignable
 *
 * Cas limites cibles :
 * - succes de jonction avec verrouillage automatique quand la salle devient pleine
 * - erreur de service lors de la tentative de jonction
 *
 * Ces cas sont suffisants ici parce que leave, kick et disconnect relevent davantage
 * de la vue d'attente que du cas d'usage strict "joindre une partie".
 */
describe('RoomGateway room events', () => {
    const hostId = 'host-1';
    const roomId = 'ROOM01';

    let gateway: RoomGateway;
    let roomService: jest.Mocked<
        Pick<
            RoomService,
            | 'addVirtualPlayer'
            | 'createRoom'
            | 'getJoinableRooms'
            | 'getRoom'
            | 'joinRoom'
            | 'kickPlayer'
            | 'leaveRoom'
            | 'markRoomAsStarted'
            | 'removeRoom'
        >
    >;
    let gameService: jest.Mocked<Pick<GameService, 'getGame'>>;
    let gameSessionService: jest.Mocked<
        Pick<GameSessionService, 'createSession' | 'getSession' | 'getSessionView' | 'abandonPlayer' | 'removeSession'>
    >;
    let virtualPlayerService: jest.Mocked<Pick<VirtualPlayerService, 'clearRoom' | 'configureRoom' | 'onGameStateUpdate'>>;
    let targetedEmitters: Map<string, { emit: jest.Mock }>;
    let broadcastEmit: jest.Mock;
    let socketsLeave: jest.Mock;
    let socketRegistry: Map<string, { data: { roomId?: string } }>;

    const createCharacter = (): PlayerCharacter => ({
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
    });

    const createPayload: CreateRoomPayload = {
        name: 'Host',
        avatar: { avatarName: AvatarName.Barbie, imageUrl: 'assets/barbie.png' },
        playerType: PlayerType.HumanPlayer,
        character: createCharacter(),
        gameId: 'game-1',
        gameName: 'Test Game',
        gridSize: GridSize.Small,
        mode: 'CLASSIC',
    };

    const room: RoomState = {
        roomId,
        hostId,
        gameId: 'game-1',
        gameName: 'Test Game',
        maxPlayers: 4,
        isLocked: false,
        mode: 'CLASSIC',
        players: [
            {
                id: hostId,
                name: 'Host',
                avatar: createPayload.avatar,
                playerType: PlayerType.HumanPlayer,
                character: createCharacter(),
            },
            {
                id: 'player-2',
                name: 'Guest',
                avatar: { avatarName: AvatarName.Ken, imageUrl: 'assets/ken.png' },
                playerType: PlayerType.HumanPlayer,
                character: createCharacter(),
            },
            {
                id: 'player-3',
                name: 'Guest-2',
                avatar: { avatarName: AvatarName.Nikki, imageUrl: 'assets/nikki.png' },
                playerType: PlayerType.HumanPlayer,
                character: createCharacter(),
            },
        ],
    };

    const joinableRooms: JoinableRoomSummary[] = [
        {
            roomId,
            hostName: 'Host',
            gameName: 'Test Game',
            currentPlayers: 1,
            maxPlayers: 2,
            isLocked: false,
            mode: 'CLASSIC',
        },
    ];
    const session: GameSessionState = {
        sessionId: roomId,
        roomId,
        gameId: 'game-1',
        gridSize: GridSize.Small,
        cells: [],
        players: [],
        activePlayerId: hostId,
        phase: 'turn',
        countdownMode: 'turn',
        countdownCombatPlayerIds: [],
        turnRemainingSeconds: 30,
        debugMode: false,
        messages: [],
    };

    const createClient = (id: string): jest.Mocked<Pick<Socket, 'id' | 'join' | 'leave' | 'emit' | 'data'>> => ({
        id,
        join: jest.fn(),
        leave: jest.fn(),
        emit: jest.fn(),
        data: {},
    });

    beforeEach(() => {
        roomService = {
            addVirtualPlayer: jest.fn(),
            createRoom: jest.fn(),
            getJoinableRooms: jest.fn(),
            getRoom: jest.fn(),
            joinRoom: jest.fn(),
            kickPlayer: jest.fn(),
            leaveRoom: jest.fn(),
            markRoomAsStarted: jest.fn(),
            removeRoom: jest.fn(),
        };
        gameService = {
            getGame: jest.fn(),
        };
        gameSessionService = {
            createSession: jest.fn(),
            getSession: jest.fn(),
            getSessionView: jest.fn(),
            abandonPlayer: jest.fn(),
            removeSession: jest.fn(),
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
        targetedEmitters = new Map();
        broadcastEmit = jest.fn();
        socketsLeave = jest.fn();
        socketRegistry = new Map();
        (gateway as unknown as { server: Server }).server = {
            to: jest.fn().mockImplementation((target: string) => {
                if (!targetedEmitters.has(target)) {
                    targetedEmitters.set(target, { emit: jest.fn() });
                }

                return targetedEmitters.get(target);
            }),
            emit: broadcastEmit,
            in: jest.fn().mockReturnValue({ socketsLeave }),
            sockets: { sockets: socketRegistry },
        } as unknown as Server;
    });

    it('handleJoin should join the room, emit state and notify the joined player', () => {
        const client = createClient('player-3');
        roomService.joinRoom.mockReturnValue({
            room,
            addedPlayer: room.players[1],
            lockChange: 'locked',
        });
        roomService.getJoinableRooms.mockReturnValue(joinableRooms);

        gateway.handleJoin(
            { roomId, name: 'Guest', avatar: room.players[1].avatar, playerType: PlayerType.HumanPlayer, character: createCharacter() },
            client as unknown as Socket,
        );

        expect(client.data.roomId).toBe(roomId);
        expect(client.join).toHaveBeenCalledWith(roomId);
        expect(targetedEmitters.get(roomId)?.emit).toHaveBeenCalledWith(RoomEvents.State, room);
        expect(targetedEmitters.get(roomId)?.emit).toHaveBeenCalledWith(RoomEvents.Joined, { roomId, player: room.players[1] });
        expect(targetedEmitters.get(roomId)?.emit).toHaveBeenCalledWith(RoomEvents.Locked, { roomId, isLocked: true, reason: 'maxReached' });
        expect(broadcastEmit).toHaveBeenCalledWith(RoomEvents.JoinableRooms, joinableRooms);
    });

    it('handleAddVirtualPlayer should allow the host to add a virtual player and emit the updated room', () => {
        const client = createClient(hostId);
        const payload: AddVirtualPlayerPayload = {
            roomId,
            playstyle: Playstyle.Offensive,
            playerAvatars: [room.players[0].avatar, room.players[1].avatar],
        };
        const virtualPlayer = {
            id: 'virtual-ROOM01-1',
            name: 'Botanix',
            avatar: { avatarName: AvatarName.Nikki, imageUrl: 'assets/nikki.png' },
            playerType: PlayerType.VirtualPlayer,
            character: createCharacter(),
            playstyle: Playstyle.Offensive,
        };

        roomService.getRoom.mockReturnValue(room);
        roomService.addVirtualPlayer.mockReturnValue({
            room: { ...room, players: [...room.players, virtualPlayer] },
            addedPlayer: virtualPlayer,
            lockChange: 'locked',
        });
        roomService.getJoinableRooms.mockReturnValue(joinableRooms);

        gateway.handleAddVirtualPlayer(payload, client as unknown as Socket);

        expect(roomService.addVirtualPlayer).toHaveBeenCalledWith(payload);
        expect(targetedEmitters.get(roomId)?.emit).toHaveBeenCalledWith(RoomEvents.Joined, {
            roomId,
            player: virtualPlayer,
        });
        expect(targetedEmitters.get(roomId)?.emit).toHaveBeenCalledWith(RoomEvents.Locked, {
            roomId,
            isLocked: true,
            reason: 'maxReached',
        });
    });

    it('handleJoin should emit an error when roomService throws', () => {
        const client = createClient('player-3');
        roomService.joinRoom.mockImplementation(() => {
            throw new Error('Salle verrouillee.');
        });

        gateway.handleJoin(
            { roomId, name: 'Guest', avatar: room.players[1].avatar, playerType: PlayerType.HumanPlayer, character: createCharacter() },
            client as unknown as Socket,
        );

        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, { code: 'ROOM_ERROR', message: 'Salle verrouillee.' });
    });

    it('handleJoin should refuse a room that already has a running session', () => {
        const client = createClient('player-3');
        gameSessionService.getSession.mockReturnValue(session);

        gateway.handleJoin(
            { roomId, name: 'Guest', avatar: room.players[1].avatar, playerType: PlayerType.HumanPlayer, character: createCharacter() },
            client as unknown as Socket,
        );

        expect(roomService.joinRoom).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'La partie a deja commence. Vous ne pouvez plus la joindre.',
        });
    });

    it('handleStart should emit an error when the room is missing', async () => {
        const client = createClient(hostId);
        roomService.getRoom.mockReturnValue(undefined);

        await gateway.handleStart({ roomId }, client as unknown as Socket);

        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, { code: 'ROOM_ERROR', message: 'Salle introuvable.' });
    });

    it('handleStart should reject a non-host player', async () => {
        const client = createClient('player-2');
        roomService.getRoom.mockReturnValue(room);

        await gateway.handleStart({ roomId }, client as unknown as Socket);

        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: "Seul l'organisateur peut lancer la partie.",
        });
    });

    it('handleStart should reject a room with fewer than two players', async () => {
        const client = createClient(hostId);
        roomService.getRoom.mockReturnValue({ ...room, players: [room.players[0]] });

        await gateway.handleStart({ roomId }, client as unknown as Socket);

        expect(gameService.getGame).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Au moins deux joueurs sont requis.',
        });
    });

    it('handleStart should reject a missing game', async () => {
        const client = createClient(hostId);
        roomService.getRoom.mockReturnValue(room);
        gameService.getGame.mockResolvedValue(undefined);

        await gateway.handleStart({ roomId }, client as unknown as Socket);

        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Jeu introuvable.',
        });
    });

    it('handleStart should reject CTF games when player count is odd', async () => {
        const client = createClient(hostId);
        roomService.getRoom.mockReturnValue(room);
        gameService.getGame.mockResolvedValue({ id: 'game-1', mode: Mode.CTF, cells: [] } as never);

        await gateway.handleStart({ roomId }, client as unknown as Socket);

        expect(gameSessionService.createSession).not.toHaveBeenCalled();
        expect(client.emit).toHaveBeenCalledWith(RoomEvents.Error, {
            code: 'ROOM_ERROR',
            message: 'Une partie CTF requiert un nombre pair de joueurs.',
        });
    });

    it('handleStart should create the session, mark the room as started and emit the start events', async () => {
        const client = createClient(hostId);
        const storedGame = { id: 'game-1', mode: Mode.Classic, cells: [] };
        const hostView = {
            ...session,
            messages: [
                {
                    id: 'host',
                    text: 'Host view',
                    type: 'system' as const,
                    createdAt: '2026-01-01T00:00:00.000Z',
                },
            ],
        };
        const player2View = { ...session, messages: [{ id: 'p2', text: 'P2 view', type: 'system' as const, createdAt: '2026-01-01T00:00:00.000Z' }] };
        const player3View = { ...session, messages: [{ id: 'p3', text: 'P3 view', type: 'system' as const, createdAt: '2026-01-01T00:00:00.000Z' }] };
        let updateCallback: ((updatedSession: GameSessionState) => void) | undefined;

        roomService.getRoom.mockReturnValue(room);
        roomService.getJoinableRooms.mockReturnValue(joinableRooms);
        gameService.getGame.mockResolvedValue(storedGame as never);
        gameSessionService.createSession.mockImplementation((_room, _game, onSessionUpdate) => {
            updateCallback = onSessionUpdate;
            return session;
        });
        gameSessionService.getSessionView.mockImplementation((_roomId, playerId) => {
            if (playerId === hostId) {
                return hostView;
            }

            if (playerId === 'player-2') {
                return player2View;
            }

            return player3View;
        });

        await gateway.handleStart({ roomId }, client as unknown as Socket);
        updateCallback?.(session);

        expect(gameSessionService.createSession).toHaveBeenCalledWith(room, storedGame, expect.any(Function), expect.any(Function));
        expect(roomService.markRoomAsStarted).toHaveBeenCalledWith(roomId);
        expect(gameSessionService.getSessionView).toHaveBeenCalledWith(roomId, hostId);
        expect(gameSessionService.getSessionView).toHaveBeenCalledWith(roomId, 'player-2');
        expect(gameSessionService.getSessionView).toHaveBeenCalledWith(roomId, 'player-3');
        expect(targetedEmitters.get(hostId)?.emit).toHaveBeenCalledWith(GameSessionEvents.State, hostView);
        expect(targetedEmitters.get('player-2')?.emit).toHaveBeenCalledWith(GameSessionEvents.State, player2View);
        expect(targetedEmitters.get('player-3')?.emit).toHaveBeenCalledWith(GameSessionEvents.State, player3View);
        expect(targetedEmitters.get(roomId)?.emit).toHaveBeenCalledWith(RoomEvents.Start, { roomId });
        expect(broadcastEmit).toHaveBeenCalledWith(RoomEvents.JoinableRooms, joinableRooms);
    });
});
