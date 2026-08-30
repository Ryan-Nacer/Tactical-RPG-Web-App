import { Injectable } from '@nestjs/common';
import { GridSize } from '@common/game';
import { AvatarName, PlayerType } from '@common/player';
import {
    AddVirtualPlayerPayload,
    CreateRoomPayload,
    JoinRoomPayload,
    JoinableRoomSummary,
    PlayerSummary,
    RoomState,
    VirtualPlayerSummary,
} from '@common/wait-room';
import { createRandomCharacter, getRandomAvatar, getRandomVirtualPlayerName } from './room.service.utils';

type LockChange = 'locked' | 'unlocked' | 'unchanged';

const ROOM_ID_LENGTH = 6;
const BASE_36 = 36;
const PREFIX_LENGTH = 2;
const SMALL_GRID_MAX_PLAYERS = 2;
const MEDIUM_GRID_MAX_PLAYERS = 4;
const LARGE_GRID_MAX_PLAYERS = 6;

interface JoinRoomResult {
    room: RoomState;
    addedPlayer?: PlayerSummary;
    lockChange: LockChange;
}

interface AddVirtualPlayerResult {
    room: RoomState;
    addedPlayer?: VirtualPlayerSummary;
    lockChange: LockChange;
}

export interface LeaveRoomResult {
    room?: RoomState;
    removedPlayer?: PlayerSummary;
    wasHost: boolean;
    lockChange: LockChange;
}

@Injectable()
export class RoomService {
    private readonly rooms = new Map<string, RoomState>();
    private readonly reservedAvatars = new Map<string, Map<string, AvatarName>>();
    private readonly startedRooms = new Set<string>();
    private readonly virtualPlayerCounters = new Map<string, number>();

    getRoom(roomId: string): RoomState | undefined {
        return this.rooms.get(roomId);
    }

    getRoomByGameId(gameId: string): RoomState | undefined {
        return Array.from(this.rooms.values()).find((room) => room.gameId === gameId);
    }

    createRoom(playerId: string, payload: CreateRoomPayload): RoomState {
        this.removeExistingWaitingRoomsForHost(playerId);

        const roomId = this.generateRoomId();
        const { name, avatar, character, gameId, gameName, gridSize, mode } = payload;
        const maxPlayers = this.getMaxPlayersFromGridSize(gridSize);

        const host: PlayerSummary = {
            id: playerId,
            name,
            avatar,
            playerType: payload.playerType ?? PlayerType.HumanPlayer,
            character,
        };

        const room: RoomState = {
            roomId,
            hostId: playerId,
            gameId,
            gameName,
            players: [host],
            maxPlayers,
            isLocked: false,
            mode,
        };

        this.rooms.set(roomId, room);
        this.startedRooms.delete(roomId);
        this.virtualPlayerCounters.delete(roomId);
        return room;
    }

    markRoomAsStarted(roomId: string): void {
        if (this.rooms.has(roomId)) {
            this.startedRooms.add(roomId);
        }
    }

    getJoinableRooms(): JoinableRoomSummary[] {
        return Array.from(this.rooms.values())
            .filter((room) => !this.startedRooms.has(room.roomId) && !room.isLocked && room.players.length < room.maxPlayers)
            .map((room) => ({
                roomId: room.roomId,
                hostName: room.players.find((player) => player.id === room.hostId)?.name ?? 'Organisateur inconnu',
                gameName: room.gameName,
                currentPlayers: room.players.length,
                maxPlayers: room.maxPlayers,
                isLocked: room.isLocked,
                mode: room.mode,
            }));
    }

    getTakenAvatars(roomId: string): AvatarName[] {
        const room = this.rooms.get(roomId);
        if (!room) {
            return [];
        }

        return room.players.map((player) => player.avatar.avatarName);
    }
    reserveTemporaryAvatar(roomId: string, socketId: string, avatar: AvatarName): void {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error('Salle introuvable');
        }

        let roomReservations = this.reservedAvatars.get(roomId);
        if (!roomReservations) {
            roomReservations = new Map<string, AvatarName>();
            this.reservedAvatars.set(roomId, roomReservations);
        }

        const isAlreadyCurrentReservedAvatar = roomReservations.get(socketId) === avatar;

        const isAvatarTakenByOtherPlayer = room.players.some((player) => player.avatar.avatarName === avatar);
        if (isAvatarTakenByOtherPlayer) {
            throw new Error('Avatar indisponible');
        }

        const isAvatarReservedByAnotherSocket = Array.from(roomReservations.entries()).some(
            ([reservedSocketId, reservedAvatar]) => reservedSocketId !== socketId && reservedAvatar === avatar,
        );
        if (isAvatarReservedByAnotherSocket) {
            throw new Error('Avatar indisponible');
        }

        if (isAlreadyCurrentReservedAvatar) {
            return;
        }

        roomReservations.set(socketId, avatar);
    }

    freeTemporaryReservation(roomId: string, socketId: string): void {
        const roomReservations = this.reservedAvatars.get(roomId);
        if (!roomReservations) {
            return;
        }

        roomReservations.delete(socketId);

        if (roomReservations.size === 0) {
            this.reservedAvatars.delete(roomId);
        }
    }

    getUnavailableAvatars(roomId: string): AvatarName[] {
        const tempReservedAvatarsMap = this.reservedAvatars.get(roomId);
        const tempReservedavatars = tempReservedAvatarsMap ? Array.from(tempReservedAvatarsMap.values()) : [];

        const playersAvatars = this.getTakenAvatars(roomId);

        return Array.from(new Set([...playersAvatars, ...tempReservedavatars]));
    }

    addVirtualPlayer(payload: AddVirtualPlayerPayload): AddVirtualPlayerResult {
        const room = this.rooms.get(payload.roomId);
        if (!room) {
            throw new Error('Salle introuvable.');
        }

        if (this.startedRooms.has(payload.roomId)) {
            throw new Error('La partie a deja commence.');
        }

        if (room.isLocked || room.players.length >= room.maxPlayers) {
            throw new Error('Salle verrouillee.');
        }

        const avatar = getRandomAvatar(this.getUnavailableAvatars(payload.roomId), payload.playerAvatars);
        if (!avatar) {
            throw new Error('Aucun avatar n est disponible pour un joueur virtuel.');
        }

        const character = createRandomCharacter();
        const unavailableNames = room.players.map((player) => this.normalizePlayerName(player.name));
        const randomName = getRandomVirtualPlayerName(unavailableNames);
        if (!randomName) {
            throw new Error('Aucun nom disponible pour un joueur virtuel.');
        }

        const name = this.resolveUniquePlayerName(room, randomName);

        const newPlayer: VirtualPlayerSummary = {
            id: this.createVirtualPlayerId(room.roomId),
            name,
            avatar,
            playerType: PlayerType.VirtualPlayer,
            character,
            playstyle: payload.playstyle,
        };

        room.players = [...room.players, newPlayer];

        return {
            room,
            addedPlayer: newPlayer,
            lockChange: this.updateLock(room),
        };
    }

    joinRoom(playerId: string, payload: JoinRoomPayload): JoinRoomResult {
        const { roomId, name, avatar, character } = payload;
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error('Salle introuvable');
        }

        if (this.startedRooms.has(roomId)) {
            throw new Error('La partie a deja commence.');
        }

        const existingPlayer = room.players.find((player) => player.id === playerId);
        if (existingPlayer) {
            return {
                room,
                lockChange: 'unchanged',
            };
        }

        if (room.isLocked || room.players.length >= room.maxPlayers) {
            throw new Error('Salle verrouillee.');
        }

        const newName = this.resolveUniquePlayerName(room, name);

        const newPlayer: PlayerSummary = {
            id: playerId,
            name: newName,
            avatar,
            playerType: payload.playerType ?? PlayerType.HumanPlayer,
            character,
        };
        room.players = [...room.players, newPlayer];

        return {
            room,
            addedPlayer: newPlayer,
            lockChange: this.updateLock(room),
        };
    }

    leaveRoom(roomId: string, playerId: string): LeaveRoomResult {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { wasHost: false, lockChange: 'unchanged' };
        }

        const removedPlayer = room.players.find((player) => player.id === playerId);
        if (!removedPlayer) {
            return { room, wasHost: false, lockChange: 'unchanged' };
        }

        room.players = room.players.filter((player) => player.id !== playerId);

        if (room.hostId === playerId) {
            this.removeRoom(roomId);
            return { removedPlayer, wasHost: true, lockChange: 'unchanged' };
        }

        return {
            room,
            removedPlayer,
            wasHost: false,
            lockChange: this.updateLock(room),
        };
    }

    kickPlayer(roomId: string, playerId: string): LeaveRoomResult {
        return this.leaveRoom(roomId, playerId);
    }

    removeRoom(roomId: string): void {
        this.rooms.delete(roomId);
        this.startedRooms.delete(roomId);
        this.reservedAvatars.delete(roomId);
        this.virtualPlayerCounters.delete(roomId);
    }

    private generateRoomId(): string {
        let roomId: string;
        do {
            roomId = Math.random()
                .toString(BASE_36)
                .substring(PREFIX_LENGTH, PREFIX_LENGTH + ROOM_ID_LENGTH)
                .toUpperCase();
        } while (this.rooms.has(roomId));
        return roomId;
    }

    private getMaxPlayersFromGridSize(size: GridSize): number {
        switch (size) {
            case GridSize.Small:
                return SMALL_GRID_MAX_PLAYERS;
            case GridSize.Medium:
                return MEDIUM_GRID_MAX_PLAYERS;
            case GridSize.Large:
                return LARGE_GRID_MAX_PLAYERS;
            default:
                return SMALL_GRID_MAX_PLAYERS;
        }
    }

    private updateLock(room: RoomState): LockChange {
        const wasLocked = room.isLocked;
        room.isLocked = room.players.length >= room.maxPlayers;

        if (room.isLocked === wasLocked) {
            return 'unchanged';
        }

        return room.isLocked ? 'locked' : 'unlocked';
    }

    private createVirtualPlayerId(roomId: string): string {
        const nextIndex = (this.virtualPlayerCounters.get(roomId) ?? 0) + 1;
        this.virtualPlayerCounters.set(roomId, nextIndex);
        return `virtual-${roomId}-${nextIndex}`;
    }

    private removeExistingWaitingRoomsForHost(hostId: string): void {
        const existingWaitingRooms = Array.from(this.rooms.values()).filter((room) => room.hostId === hostId && !this.startedRooms.has(room.roomId));

        for (const room of existingWaitingRooms) {
            this.removeRoom(room.roomId);
        }
    }

    private resolveUniquePlayerName(room: RoomState, name: string): string {
        const normalizedName = this.normalizePlayerName(name);
        let nameExists = room.players.some((p) => this.normalizePlayerName(p.name) === normalizedName);
        let newName = normalizedName;

        if (nameExists) {
            let count = 1;
            while (nameExists) {
                count++;
                nameExists = room.players.some((p) => this.normalizePlayerName(p.name) === `${normalizedName}-${count}`);
            }
            newName = `${normalizedName}-${count}`;
        }
        return newName;
    }

    private normalizePlayerName(name: string): string {
        let normalizedName = name;
        normalizedName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1).toLowerCase();
        return normalizedName;
    }
}
