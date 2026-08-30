import { GameSessionService } from '@app/services/game-session/game-session.service';
import { GameService } from '@app/services/game/game.service';
import { RoomService } from '@app/services/room/room.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player.service';
import {
    CombatChoosePosturePayload,
    EndTurnPayload,
    FlagTransferRequestPayload,
    FlagTransferResponsePayload,
    GameSessionEvents,
    GameSessionState,
    MovePlayerPayload,
    PerformActionPayload,
    TeleportPlayerPayload,
    ToggleDebugPayload,
} from '@common/game-session';
import {
    AddVirtualPlayerPayload,
    CreateRoomPayload,
    JoinRoomPayload,
    KickPlayerPayload,
    LeaveRoomPayload,
    ReleaseTemporaryAvatarPayload,
    RequestTakenAvatarsPayload,
    ReserveTemporaryAvatarPayload,
    RoomCancelledPayload,
    RoomEvents,
    RoomState,
    StartRoomPayload,
} from '@common/wait-room';
import { Injectable } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
    emitJoinableRooms,
    emitRoomError,
    getPlayerById,
    getSessionOrEmitError,
    handleKickPlayer,
    handleReleaseTemporaryAvatar,
    handleRequestTakenAvatars,
    handleReserveTemporaryAvatar,
    isActivePlayerClient,
    isTurnPhase,
    removePlayer,
} from './room.gateway.utils';
import { handleAddVirtualPlayerRoom, handleCreateRoom, handleJoinRoom, handleStartRoom, handleLeaveRoomAction } from './room.handlers';
import { ROOM_ERRORS } from './room.constants';

@WebSocketGateway({ cors: true })
@Injectable()
export class RoomGateway implements OnGatewayDisconnect {
    @WebSocketServer() private server: Server;

    constructor(
        private readonly roomService: RoomService,
        private readonly gameService: GameService,
        private readonly gameSessionService: GameSessionService,
        private readonly virtualPlayerService: VirtualPlayerService,
    ) {}

    @SubscribeMessage(RoomEvents.Create)
    handleCreate(@MessageBody() payload: CreateRoomPayload, @ConnectedSocket() client: Socket): void {
        handleCreateRoom(this.server, this.roomService, client, payload, this.leaveSocketFromAllRooms.bind(this));
    }

    @SubscribeMessage(RoomEvents.Join)
    handleJoin(@MessageBody() payload: JoinRoomPayload, @ConnectedSocket() client: Socket): void {
        handleJoinRoom({
            server: this.server,
            roomService: this.roomService,
            gameSessionService: this.gameSessionService,
            client,
            payload,
            leaveSocketFromAllRooms: this.leaveSocketFromAllRooms.bind(this),
        });
    }

    @SubscribeMessage(RoomEvents.AddVirtualPlayer)
    handleAddVirtualPlayer(@MessageBody() payload: AddVirtualPlayerPayload, @ConnectedSocket() client: Socket): void {
        handleAddVirtualPlayerRoom({ server: this.server, roomService: this.roomService, client, payload });
    }

    @SubscribeMessage(RoomEvents.RequestTakenAvatars)
    handleRequestTakenAvatars(@MessageBody() payload: RequestTakenAvatarsPayload, @ConnectedSocket() client: Socket): void {
        handleRequestTakenAvatars(this.server, this.roomService, payload, client);
    }

    @SubscribeMessage(RoomEvents.ReserveTemporaryAvatar)
    handleReserveTemporaryAvatar(@MessageBody() payload: ReserveTemporaryAvatarPayload, @ConnectedSocket() client: Socket): void {
        handleReserveTemporaryAvatar(this.server, this.roomService, payload, client);
    }

    @SubscribeMessage(RoomEvents.ReleaseTemporaryAvatar)
    handleReleaseTemporaryAvatar(@MessageBody() payload: ReleaseTemporaryAvatarPayload, @ConnectedSocket() client: Socket): void {
        handleReleaseTemporaryAvatar(this.server, this.roomService, payload, client);
    }

    @SubscribeMessage(RoomEvents.Leave)
    handleLeave(@MessageBody() payload: LeaveRoomPayload, @ConnectedSocket() client: Socket): void {
        removePlayer(
            {
                server: this.server,
                roomService: this.roomService,
                gameSessionService: this.gameSessionService,
                virtualPlayerService: this.virtualPlayerService,
            },
            client,
            payload.roomId,
            'left',
        );
    }

    @SubscribeMessage(RoomEvents.Kick)
    handleKickPlayer(@MessageBody() payload: KickPlayerPayload, @ConnectedSocket() client: Socket): void {
        handleKickPlayer(this.server, this.roomService, payload, client);
    }

    @SubscribeMessage(RoomEvents.Start)
    async handleStart(@MessageBody() payload: StartRoomPayload, @ConnectedSocket() client: Socket): Promise<void> {
        await handleStartRoom({
            server: this.server,
            roomService: this.roomService,
            gameService: this.gameService,
            gameSessionService: this.gameSessionService,
            virtualPlayerService: this.virtualPlayerService,
            client,
            payload,
            emitSessionStateToRoomPlayers: this.emitSessionStateToRoomPlayers.bind(this),
            closeRoomAfterGameEnd: this.closeRoomAfterGameEnd.bind(this),
        });
    }

    @SubscribeMessage(GameSessionEvents.EndTurn)
    handleEndTurn(@MessageBody() payload: EndTurnPayload, @ConnectedSocket() client: Socket): void {
        const session = getSessionOrEmitError(this.gameSessionService, payload.roomId, client);
        if (!session || !isTurnPhase(session, client, "Impossible d'agir pendant la transition de tour.")) {
            return;
        }

        if (session.countdownMode === 'combat') {
            emitRoomError(client, new Error('Impossible de terminer le tour pendant un combat.'));
            return;
        }

        const activePlayer = getPlayerById(session, session.activePlayerId);
        if (!activePlayer || activePlayer.hasAbandoned) {
            emitRoomError(client, new Error('Le joueur actif est introuvable.'));
            return;
        }

        if (session.activePlayerId === client.id) {
            this.gameSessionService.endTurn(payload.roomId, client.id);
            return;
        }

        const room = this.roomService.getRoom(payload.roomId);
        const canForceEndTurn = room?.hostId === client.id && session.debugMode;
        if (!canForceEndTurn) {
            emitRoomError(client, new Error('Seul le joueur actif peut terminer le tour.'));
            return;
        }

        this.gameSessionService.endTurn(payload.roomId, session.activePlayerId);
    }

    @SubscribeMessage(GameSessionEvents.PerformAction)
    handlePerformAction(@MessageBody() payload: PerformActionPayload, @ConnectedSocket() client: Socket): void {
        const session = getSessionOrEmitError(this.gameSessionService, payload.roomId, client);
        if (!session) {
            return;
        }

        if (session.countdownMode === 'combat') {
            emitRoomError(client, new Error('Impossible d effectuer une action standard pendant un combat.'));
            return;
        }

        if (!isActivePlayerClient(session, client, 'Seul le joueur actif peut effectuer une action.')) {
            return;
        }

        if (!isTurnPhase(session, client, "Impossible d'agir pendant la transition de tour.")) {
            return;
        }

        const activePlayer = getPlayerById(session, client.id);
        if (!activePlayer || activePlayer.hasAbandoned || activePlayer.actionsLeft <= 0) {
            emitRoomError(client, new Error("Le joueur actif n'a plus d'actions disponibles."));
            return;
        }

        this.gameSessionService.performAction(payload.roomId, client.id, payload);

        const pendingTransfer = this.gameSessionService.getPendingFlagTransfer(payload.roomId);
        if (!pendingTransfer) {
            return;
        }

        const initiator = session.players.find((player) => player.id === pendingTransfer.initiatorId);

        const transferPayload: FlagTransferRequestPayload = {
            roomId: payload.roomId,
            initiatorId: pendingTransfer.initiatorId,
            initiatorName: initiator?.name ?? '',
        };

        this.server.to(pendingTransfer.teammateId).emit(GameSessionEvents.FlagTransferRequest, transferPayload);
    }

    @SubscribeMessage(GameSessionEvents.FlagTransferResponse)
    handleFlagTransferResponse(@MessageBody() payload: FlagTransferResponsePayload, @ConnectedSocket() client: Socket): void {
        const session = getSessionOrEmitError(this.gameSessionService, payload.roomId, client);
        if (!session) {
            return;
        }

        this.gameSessionService.respondToFlagTransfer(payload.roomId, client.id, payload.accepted);
    }

    @SubscribeMessage(GameSessionEvents.MovePlayer)
    handleMovePlayer(@MessageBody() payload: MovePlayerPayload, @ConnectedSocket() client: Socket): void {
        const session = getSessionOrEmitError(this.gameSessionService, payload.roomId, client);
        if (!session) {
            return;
        }

        if (session.countdownMode === 'combat') {
            emitRoomError(client, new Error('Impossible de se deplacer pendant un combat.'));
            return;
        }

        if (!isActivePlayerClient(session, client, 'Seul le joueur actif peut se deplacer.')) {
            return;
        }

        if (!isTurnPhase(session, client, 'Impossible de se deplacer pendant la transition de tour.')) {
            return;
        }

        const activePlayer = getPlayerById(session, client.id);
        if (!activePlayer || activePlayer.hasAbandoned) {
            return;
        }

        const pendingTransfer = this.gameSessionService.getPendingFlagTransfer(payload.roomId);
        if (pendingTransfer?.initiatorId === client.id) {
            emitRoomError(client, new Error('Impossible de se deplacer pendant une demande de transfert du drapeau.'));
            return;
        }

        this.gameSessionService.movePlayer(payload.roomId, client.id, payload);
    }

    @SubscribeMessage(GameSessionEvents.TeleportPlayer)
    handleTeleportPlayer(@MessageBody() payload: TeleportPlayerPayload, @ConnectedSocket() client: Socket): void {
        const session = getSessionOrEmitError(this.gameSessionService, payload.roomId, client);
        if (!session) {
            return;
        }

        if (session.countdownMode === 'combat') {
            emitRoomError(client, new Error('Impossible de se teleporter pendant un combat.'));
            return;
        }

        if (!session.debugMode) {
            emitRoomError(client, new Error('Le mode debogage doit etre actif pour se teleporter.'));
            return;
        }

        if (!isActivePlayerClient(session, client, 'Seul le joueur actif peut se teleporter.')) {
            return;
        }

        if (!isTurnPhase(session, client, 'Impossible de se teleporter pendant la transition de tour.')) {
            return;
        }

        const activePlayer = getPlayerById(session, client.id);
        if (!activePlayer || activePlayer.hasAbandoned) {
            emitRoomError(client, new Error('Le joueur actif ne peut pas se teleporter.'));
            return;
        }

        this.gameSessionService.teleportPlayer(payload.roomId, client.id, payload);
    }

    @SubscribeMessage(GameSessionEvents.ToggleDebug)
    handleToggleDebug(@MessageBody() payload: ToggleDebugPayload, @ConnectedSocket() client: Socket): void {
        const room = this.roomService.getRoom(payload.roomId);
        if (!room) {
            emitRoomError(client, new Error(ROOM_ERRORS.notFound));
            return;
        }

        if (room.hostId !== client.id) {
            emitRoomError(client, new Error("Seul l'organisateur peut activer le mode debug."));
            return;
        }

        const session = this.gameSessionService.toggleDebugMode(payload.roomId);
        if (!session) {
            emitRoomError(client, new Error('Session de jeu introuvable.'));
        }
    }

    @SubscribeMessage(GameSessionEvents.CombatChoosePosture)
    handleChooseCombatPosture(@MessageBody() payload: CombatChoosePosturePayload, @ConnectedSocket() client: Socket): void {
        const session = getSessionOrEmitError(this.gameSessionService, payload.roomId, client);
        if (!session) {
            return;
        }

        if (session.countdownMode !== 'combat') {
            emitRoomError(client, new Error('Aucun combat en cours.'));
            return;
        }

        if (!session.combatState) {
            emitRoomError(client, new Error('Etat du combat introuvable.'));
            return;
        }

        const isCombatParticipant = session.combatState.attackerId === client.id || session.combatState.defenderId === client.id;
        if (!isCombatParticipant) {
            emitRoomError(client, new Error('Seuls les combattants peuvent choisir une posture.'));
            return;
        }

        this.gameSessionService.chooseCombatPosture(payload.roomId, client.id, payload.posture);
    }

    handleDisconnect(client: Socket): void {
        const roomId = client.data.roomId as string | undefined;

        if (roomId) {
            removePlayer(
                {
                    server: this.server,
                    roomService: this.roomService,
                    gameSessionService: this.gameSessionService,
                    virtualPlayerService: this.virtualPlayerService,
                },
                client,
                roomId,
                'disconnected',
            );
        }
    }

    @SubscribeMessage('leaveRoom')
    handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }) {
        handleLeaveRoomAction({ server: this.server, roomService: this.roomService, client, roomId: data.roomId });
    }

    private leaveSocketFromAllRooms(client: Socket): void {
        const joinedRooms = client.rooms ? Array.from(client.rooms) : [];
        for (const joinedRoomId of joinedRooms) {
            if (joinedRoomId !== client.id) {
                client.leave(joinedRoomId);
            }
        }
        client.data.roomId = undefined;
    }

    private closeRoomAfterGameEnd(session: GameSessionState): void {
        const roomId = session.roomId;
        const winner = session.players.find((player) => player.id === session.winnerPlayerId);
        const message = winner ? `${winner.name} remporte la partie.` : 'La partie est terminee.';
        const payload: RoomCancelledPayload = {
            roomId,
            reason: 'gameCancelled',
            message,
        };

        const room = this.roomService.getRoom(roomId);
        if (room) {
            room.isGameOver = true;
        }

        this.server.to(roomId).emit(RoomEvents.Cancelled, payload);

        const socketIds = this.server.sockets.adapter.rooms.get(roomId);
        if (socketIds) {
            for (const socketId of socketIds) {
                const socket = this.server.sockets.sockets.get(socketId);
                if (socket) {
                    socket.data.roomId = undefined;
                }
            }
        }

        this.virtualPlayerService.clearRoom(roomId);
        emitJoinableRooms(this.server, this.roomService);
    }

    private emitSessionStateToRoomPlayers(room: RoomState, session: GameSessionState): void {
        for (const player of room.players) {
            const playerView = this.gameSessionService.getSessionView(session.roomId, player.id) ?? session;
            this.server.to(player.id).emit(GameSessionEvents.State, playerView);
        }
    }
}
