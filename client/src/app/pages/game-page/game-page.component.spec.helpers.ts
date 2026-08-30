import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { GameClientService } from '@app/services/game-client.service';
import { GridSize, Mode, TileId } from '@common/game';
import { DEFAULT_GAME_TURN_COUNTDOWN, FlagTransferRequestPayload, GameSessionState } from '@common/game-session';
import { AvatarName, PlayerType } from '@common/player';
import { RoomCancelledPayload, RoomState } from '@common/wait-room';
import { EMPTY, Observable, of } from 'rxjs';

const baseRoomPlayer = {
    id: 'player-1',
    name: 'Hote',
    avatar: {
        imageUrl: 'assets/characters/barbie.png',
        avatarName: AvatarName.Barbie,
    },
    playerType: PlayerType.HumanPlayer,
    character: {
        health: 6,
        maxHealth: 6,
        speed: 6,
        attack: 4,
        defense: 4,
        attackDice: 'D4' as const,
        defenseDice: 'D6' as const,
        movementPointsLeft: 6,
        combatSanctuaryPointsLeft: 2,
        actionsLeft: 1,
    },
};

const baseSessionPlayer = {
    id: 'player-1',
    name: 'Hote',
    avatar: {
        imageUrl: 'assets/characters/barbie.png',
        avatarName: AvatarName.Barbie,
    },
    playerType: PlayerType.HumanPlayer,
    maxHealth: 6,
    health: 6,
    speed: 6,
    attack: 4,
    defense: 4,
    attackDice: 'D4' as const,
    defenseDice: 'D6' as const,
    movementPointsLeft: 6,
    combatSanctuaryPointsLeft: 2,
    actionsLeft: 1,
    combatsWon: 0,
    turnOrder: 1,
    isHost: true,
    hasAbandoned: false,
    position: { row: 0, column: 0 },
};

export function createActivatedRouteStub(): Pick<ActivatedRoute, 'snapshot'> {
    return {
        snapshot: {
            queryParamMap: convertToParamMap({
                room: 'ROOM01',
                gameId: 'game-1',
            }),
        } as ActivatedRoute['snapshot'],
    };
}

export function createRoomState(): RoomState {
    return {
        roomId: 'ROOM01',
        hostId: 'player-1',
        gameId: 'game-1',
        gameName: 'Jeu test',
        players: [
            {
                ...baseRoomPlayer,
                avatar: { ...baseRoomPlayer.avatar },
                character: { ...baseRoomPlayer.character },
            },
        ],
        maxPlayers: 2,
        isLocked: false,
        mode: 'CLASSIC',
    };
}

export function createGameSessionState(): GameSessionState {
    return {
        sessionId: 'ROOM01',
        roomId: 'ROOM01',
        gameId: 'game-1',
        gridSize: GridSize.Small,
        cells: [{ row: 0, column: 0, tile: TileId.Base }],
        players: [
            {
                ...baseSessionPlayer,
                avatar: { ...baseSessionPlayer.avatar },
                position: { ...baseSessionPlayer.position },
            },
        ],
        activePlayerId: 'player-1',
        phase: 'turn',
        countdownMode: 'turn',
        countdownCombatPlayerIds: [],
        turnRemainingSeconds: DEFAULT_GAME_TURN_COUNTDOWN,
        debugMode: false,
        messages: [],
    };
}

export function createRoomSocketServiceStub(roomState: RoomState, gameSessionState: GameSessionState) {
    return {
        currentRoomState: roomState,
        currentGameSessionState: gameSessionState,
        roomState$: of(roomState),
        gameSessionState$: of(gameSessionState),
        cancelled$: EMPTY as Observable<RoomCancelledPayload>,
        flagTransferRequest$: EMPTY as Observable<FlagTransferRequestPayload>,
        socketId: 'player-1',
        endTurn: jasmine.createSpy('endTurn'),
        performAction: jasmine.createSpy('performAction'),
        respondToFlagTransfer: jasmine.createSpy('respondToFlagTransfer'),
        toggleDebug: jasmine.createSpy('toggleDebug'),
        movePlayer: jasmine.createSpy('movePlayer'),
        teleportPlayer: jasmine.createSpy('teleportPlayer'),
        chooseCombatPosture: jasmine.createSpy('chooseCombatPosture'),
        leave: jasmine.createSpy('leave'),
        resetRoomState: jasmine.createSpy('resetRoomState'),
    };
}

export type RoomSocketServiceStub = ReturnType<typeof createRoomSocketServiceStub>;

export function createGameClientServiceSpy(): jasmine.SpyObj<GameClientService> {
    const spy = jasmine.createSpyObj('GameClientService', ['getGame', 'extractErrors']) as jasmine.SpyObj<GameClientService>;
    spy.getGame.and.returnValue(
        of({
            id: 'game-1',
            name: 'Jeu test',
            size: GridSize.Small,
            lastModified: '2026-03-08',
            description: 'Description',
            mode: Mode.Classic,
            isVisible: true,
            cells: [{ row: 0, column: 0, tile: TileId.Base }],
        }),
    );
    spy.extractErrors.and.returnValue(['Erreur']);
    return spy;
}

export function createChatSocketServiceStub() {
    return {
        messages$: of([]),
        joinRoom: jasmine.createSpy('joinRoom'),
        leaveRoom: jasmine.createSpy('leaveRoom'),
        sendMessage: jasmine.createSpy('sendMessage'),
    };
}

export type ChatSocketServiceStub = ReturnType<typeof createChatSocketServiceStub>;
