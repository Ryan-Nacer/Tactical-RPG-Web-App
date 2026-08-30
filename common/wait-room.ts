import { GridSize } from './game';
import { GameDice } from './game-session';
import { AvatarName, PlayerAvatar, PlayerType } from './player';

export enum RoomEvents {
    Create = 'create',
    Join = 'join',
    Leave = 'leave',
    Kick = 'kick',
    Start = 'start',
    State = 'state',
    Joined = 'joined',
    Left = 'left',
    Kicked = 'kicked',
    Locked = 'locked',
    Unlocked = 'unlocked',
    Cancelled = 'cancelled',
    Error = 'error',
    JoinableRooms = 'joinableRooms',
    RequestTakenAvatars = 'requestTakenAvatars',
    TakenAvatarsUpdated = 'takenAvatarsUpdated',
    ReserveTemporaryAvatar = 'reserveTemporaryAvatar',
    ReleaseTemporaryAvatar = 'releaseTemporaryAvatar',
    AddVirtualPlayer = 'addVirtualPlayer',
}

export interface PlayerCharacter {
    health: number;
    maxHealth: number;
    speed: number;
    attack: number;
    defense: number;
    attackDice: GameDice;
    defenseDice: GameDice;
    movementPointsLeft: number;
    combatSanctuaryPointsLeft: number;
    actionsLeft: number;
}

export interface PlayerSummary {
    id: string;
    name: string;
    avatar: PlayerAvatar;
    playerType: PlayerType;
    character: PlayerCharacter;
}

/** Profil de comportement d'un joueur virtuel. Les valeurs restent en anglais pour le transport (socket). */
export enum Playstyle {
    /** Comportement dit « agressif » dans l'énoncé (priorité combat, posture offensive). */
    Offensive = 'Offensive',
    /** Comportement dit « défensif » dans l'énoncé. */
    Defensive = 'Defensive',
}

export interface VirtualPlayerSummary extends PlayerSummary {
    /** Profil choisi par l'organisateur à l'ajout du JV. */
    playstyle: Playstyle;
}

export interface RoomState {
    roomId: string;
    hostId: string;
    gameId: string;
    gameName: string;
    players: PlayerSummary[];
    maxPlayers: number;
    isLocked: boolean;
    mode: string;
    //
    isGameOver?: boolean;
}

export interface JoinRoomPayload {
    roomId: string;
    name: string;
    avatar: PlayerAvatar;
    playerType: PlayerType;
    character: PlayerCharacter;
}

export interface CreateRoomPayload {
    name: string;
    avatar: PlayerAvatar;
    playerType: PlayerType;
    character: PlayerCharacter;
    gameId: string;
    gameName: string;
    gridSize: GridSize;
    mode: string;
}

export interface JoinableRoomSummary {
    roomId: string;
    hostName: string;
    gameName: string;
    currentPlayers: number;
    maxPlayers: number;
    isLocked: boolean;
    mode: string;
}

export interface RequestTakenAvatarsPayload {
    roomId: string;
}

export interface TakenAvatarsUpdatedPayload {
    roomId: string;
    avatars: AvatarName[];
}

export interface ReserveTemporaryAvatarPayload {
    roomId: string;
    avatar: AvatarName;
}

export interface ReleaseTemporaryAvatarPayload {
    roomId: string;
}

export interface LeaveRoomPayload {
    roomId: string;
}

export interface KickPlayerPayload {
    roomId: string;
    playerId: string;
}

export interface StartRoomPayload {
    roomId: string;
}

/** Demande d'ajout d'un JV : l'hôte envoie la salle, le profil et la liste d'avatars pour tirage aléatoire. */
export interface AddVirtualPlayerPayload {
    roomId: string;
    playstyle: Playstyle;
    playerAvatars: PlayerAvatar[];
}

export interface RoomPlayerPayload {
    roomId: string;
    player: PlayerSummary;
}

export interface RoomLeftPayload {
    roomId: string;
    playerId: string;
    playerName: string;
    reason: 'left' | 'disconnected';
}

export interface RoomKickedPayload {
    roomId: string;
    playerId: string;
    playerName: string;
    byHostId: string;
    message: string;
}

export interface RoomLockedPayload {
    roomId: string;
    isLocked: true;
    reason: 'maxReached';
}

export interface RoomUnlockedPayload {
    roomId: string;
    isLocked: false;
    reason: 'slotFreed';
}

export interface RoomCancelledPayload {
    roomId: string;
    reason: 'hostLeft' | 'gameCancelled';
    message: string;
}

export interface RoomErrorPayload {
    code: string;
    message: string;
}
