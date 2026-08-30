import { RoomService } from '@app/services/room/room.service';
import { GridSize } from '@common/game';
import { AvatarName, PlayerAvatar, PlayerType } from '@common/player';
import { AddVirtualPlayerPayload, CreateRoomPayload, JoinRoomPayload, Playstyle, PlayerCharacter } from '@common/wait-room';
import * as roomServiceUtils from './room.service.utils';

/**
 * Strategie :
 * - tester RoomService comme logique serveur de la salle d'attente du Sprint 2
 * - verifier la creation, l'entree/sortie des joueurs, le verrouillage et les noms uniques
 *
 * Cas limites cibles :
 * - salle inexistante
 * - rejoin du meme joueur
 * - salle complete qui se verrouille puis se deverrouille
 * - collision de noms normalisee cote serveur
 *
 * Ces cas sont importants parce que RoomService maintient l'etat d'attente partage avant
 * le debut d'une partie, donc une erreur ici casse la synchronisation pour tous les joueurs.
 */
describe('RoomService', () => {
    const hostId = 'host-1';
    const secondPlayerId = 'player-2';
    const FAST_SPEED = 6;
    const STANDARD_SPEED = 4;
    const ROOM_ID_RANDOM_VALUE = 0.286331153;
    const ROOM_ID_LENGTH = 6;
    const SECOND_ROOM_ID_RANDOM_VALUE = 0.286331154;
    const THIRD_ROOM_ID_RANDOM_VALUE = 0.286331155;
    const MEDIUM_GRID_MAX_PLAYERS = 4;
    const LARGE_GRID_MAX_PLAYERS = 6;

    let service: RoomService;

    const createAvatar = (avatarName: AvatarName): PlayerAvatar => ({
        avatarName,
        imageUrl: `assets/${avatarName.toLowerCase()}.png`,
    });

    const createCharacter = (speed: number): PlayerCharacter => ({
        health: 6,
        maxHealth: 6,
        speed,
        attack: 4,
        defense: 4,
        attackDice: 'D4',
        defenseDice: 'D6',
        movementPointsLeft: speed,
        combatSanctuaryPointsLeft: 0,
        actionsLeft: 1,
    });

    const createPayload: CreateRoomPayload = {
        name: 'Host',
        avatar: createAvatar(AvatarName.Barbie),
        playerType: PlayerType.HumanPlayer,
        character: createCharacter(FAST_SPEED),
        gameId: 'game-1',
        gameName: 'Test Game',
        gridSize: GridSize.Small,
        mode: 'CLASSIC',
    };

    const createJoinPayload = (name: string, roomId: string): JoinRoomPayload => ({
        roomId,
        name,
        avatar: createAvatar(AvatarName.Ken),
        playerType: PlayerType.HumanPlayer,
        character: createCharacter(STANDARD_SPEED),
    });

    const createAddVirtualPlayerPayload = (roomId: string): AddVirtualPlayerPayload => ({
        roomId,
        playstyle: Playstyle.Offensive,
        playerAvatars: [createAvatar(AvatarName.Ken), createAvatar(AvatarName.Nikki), createAvatar(AvatarName.Teresa)],
    });

    beforeEach(() => {
        service = new RoomService();
        jest.spyOn(Math, 'random').mockReturnValue(ROOM_ID_RANDOM_VALUE);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('createRoom should create a room with the host and the expected max players', () => {
        const room = service.createRoom(hostId, createPayload);

        expect(room.roomId).toHaveLength(ROOM_ID_LENGTH);
        expect(room.hostId).toBe(hostId);
        expect(room.maxPlayers).toBe(2);
        expect(room.players).toHaveLength(1);
        expect(room.players[0].id).toBe(hostId);
        expect(room.players[0].name).toBe(createPayload.name);
    });

    it('createRoom should derive the max players from medium, large and fallback grid sizes', () => {
        jest.spyOn(Math, 'random')
            .mockReturnValueOnce(ROOM_ID_RANDOM_VALUE)
            .mockReturnValueOnce(SECOND_ROOM_ID_RANDOM_VALUE)
            .mockReturnValueOnce(THIRD_ROOM_ID_RANDOM_VALUE);
        const mediumRoom = service.createRoom(hostId, { ...createPayload, gridSize: GridSize.Medium, gameId: 'game-2' });
        const largeRoom = service.createRoom('host-2', { ...createPayload, gridSize: GridSize.Large, gameId: 'game-3' });
        const fallbackRoom = service.createRoom('host-3', { ...createPayload, gridSize: -1 as GridSize, gameId: 'game-4' });

        expect(mediumRoom.maxPlayers).toBe(MEDIUM_GRID_MAX_PLAYERS);
        expect(largeRoom.maxPlayers).toBe(LARGE_GRID_MAX_PLAYERS);
        expect(fallbackRoom.maxPlayers).toBe(2);
    });

    it('createRoom should replace an existing waiting room hosted by the same player', () => {
        const firstRoom = service.createRoom(hostId, createPayload);

        jest.spyOn(Math, 'random').mockReturnValueOnce(SECOND_ROOM_ID_RANDOM_VALUE).mockReturnValue(SECOND_ROOM_ID_RANDOM_VALUE);
        const secondRoom = service.createRoom(hostId, { ...createPayload, gameId: 'game-2' });

        expect(service.getRoom(firstRoom.roomId)).toBeUndefined();
        expect(service.getRoom(secondRoom.roomId)).toBeDefined();
        expect(service.getJoinableRooms()).toHaveLength(1);
        expect(service.getJoinableRooms()[0].roomId).toBe(secondRoom.roomId);
    });

    it('getJoinableRooms should expose only rooms that are not full or locked', () => {
        const room = service.createRoom(hostId, createPayload);
        service.joinRoom(secondPlayerId, createJoinPayload('Guest', room.roomId));

        expect(service.getJoinableRooms()).toEqual([]);
    });

    it('joinRoom should normalize duplicate names and lock the room when it becomes full', () => {
        const room = service.createRoom(hostId, { ...createPayload, name: 'Alice' });

        const result = service.joinRoom(secondPlayerId, createJoinPayload('alice', room.roomId));

        expect(result.addedPlayer?.name).toBe('Alice-2');
        expect(result.lockChange).toBe('locked');
        expect(result.room.isLocked).toBe(true);
        expect(result.room.players).toHaveLength(2);
    });

    it('joinRoom should return the room unchanged when the same player joins twice', () => {
        const room = service.createRoom(hostId, createPayload);
        service.joinRoom(secondPlayerId, createJoinPayload('Guest', room.roomId));

        const result = service.joinRoom(secondPlayerId, createJoinPayload('Guest', room.roomId));

        expect(result.addedPlayer).toBeUndefined();
        expect(result.lockChange).toBe('unchanged');
        expect(result.room.players).toHaveLength(2);
    });

    it('joinRoom should throw when the room does not exist', () => {
        expect(() => service.joinRoom(secondPlayerId, createJoinPayload('Guest', 'UNKNOWN'))).toThrow('Salle introuvable');
    });

    it('addVirtualPlayer should create a virtual player with a unique id, avatar and playstyle', () => {
        const room = service.createRoom(hostId, createPayload);

        const result = service.addVirtualPlayer(createAddVirtualPlayerPayload(room.roomId));

        expect(result.addedPlayer).toBeDefined();
        expect(result.addedPlayer?.playerType).toBe(PlayerType.VirtualPlayer);
        expect(result.addedPlayer?.id).toContain(`virtual-${room.roomId}-`);
        expect('playstyle' in (result.addedPlayer ?? {})).toBe(true);
        expect(result.room.players).toHaveLength(2);
        expect(result.lockChange).toBe('locked');
        expect(roomServiceUtils.VIRTUAL_PLAYER_NAME_POOL).toContain(result.addedPlayer?.name ?? '');
    });

    it('addVirtualPlayer should throw when no predefined virtual player name is free', () => {
        const room = service.createRoom(hostId, createPayload);
        jest.spyOn(roomServiceUtils, 'getRandomVirtualPlayerName').mockReturnValue(undefined);

        expect(() => service.addVirtualPlayer(createAddVirtualPlayerPayload(room.roomId))).toThrow('Aucun nom disponible pour un joueur virtuel.');
    });

    it('reserveTemporaryAvatar should reject an unknown room', () => {
        expect(() => service.reserveTemporaryAvatar('UNKNOWN', 'socket-1', AvatarName.Ken)).toThrow('Salle introuvable');
    });

    it('reserveTemporaryAvatar should reject an avatar already taken by a player or another socket', () => {
        const room = service.createRoom(hostId, createPayload);

        expect(() => service.reserveTemporaryAvatar(room.roomId, 'socket-1', AvatarName.Barbie)).toThrow('Avatar indisponible');

        service.reserveTemporaryAvatar(room.roomId, 'socket-1', AvatarName.Ken);

        expect(() => service.reserveTemporaryAvatar(room.roomId, 'socket-2', AvatarName.Ken)).toThrow('Avatar indisponible');
    });

    it('getUnavailableAvatars should merge player avatars and temporary reservations without duplicates', () => {
        const room = service.createRoom(hostId, createPayload);

        service.reserveTemporaryAvatar(room.roomId, 'socket-1', AvatarName.Ken);
        service.reserveTemporaryAvatar(room.roomId, 'socket-1', AvatarName.Ken);

        expect(service.getUnavailableAvatars(room.roomId)).toEqual([AvatarName.Barbie, AvatarName.Ken]);
    });

    it('freeTemporaryReservation should remove only the temporary reservation and preserve taken avatars', () => {
        const room = service.createRoom(hostId, createPayload);

        service.reserveTemporaryAvatar(room.roomId, 'socket-1', AvatarName.Ken);
        service.freeTemporaryReservation(room.roomId, 'socket-2');
        service.freeTemporaryReservation(room.roomId, 'socket-1');

        expect(service.getUnavailableAvatars(room.roomId)).toEqual([AvatarName.Barbie]);
        expect(service.getTakenAvatars('UNKNOWN')).toEqual([]);
    });

    it('leaveRoom should remove the room when the host leaves', () => {
        const room = service.createRoom(hostId, createPayload);

        const result = service.leaveRoom(room.roomId, hostId);

        expect(result.wasHost).toBe(true);
        expect(result.removedPlayer?.id).toBe(hostId);
        expect(service.getRoom(room.roomId)).toBeUndefined();
    });

    it('leaveRoom should unlock the room when a non-host leaves a full room', () => {
        const room = service.createRoom(hostId, createPayload);
        service.joinRoom(secondPlayerId, createJoinPayload('Guest', room.roomId));

        const result = service.leaveRoom(room.roomId, secondPlayerId);

        expect(result.wasHost).toBe(false);
        expect(result.lockChange).toBe('unlocked');
        expect(result.room?.isLocked).toBe(false);
        expect(result.room?.players).toHaveLength(1);
    });

    it('joinRoom should throw when the room is already locked', () => {
        const room = service.createRoom(hostId, createPayload);
        service.joinRoom(secondPlayerId, createJoinPayload('Guest', room.roomId));

        expect(() => service.joinRoom('player-3', createJoinPayload('Third', room.roomId))).toThrow('Salle verrouillee.');
    });

    it('leaveRoom should return unchanged when the room does not exist', () => {
        expect(service.leaveRoom('UNKNOWN', hostId)).toEqual({ wasHost: false, lockChange: 'unchanged' });
    });

    it('leaveRoom should return unchanged when the player is not in the room', () => {
        const room = service.createRoom(hostId, createPayload);

        const result = service.leaveRoom(room.roomId, secondPlayerId);

        expect(result.wasHost).toBe(false);
        expect(result.lockChange).toBe('unchanged');
        expect(result.room).toBe(room);
    });

    it('kickPlayer should delegate to leaveRoom', () => {
        const room = service.createRoom(hostId, createPayload);
        service.joinRoom(secondPlayerId, createJoinPayload('Guest', room.roomId));

        const result = service.kickPlayer(room.roomId, secondPlayerId);

        expect(result.removedPlayer?.id).toBe(secondPlayerId);
        expect(result.wasHost).toBe(false);
    });

    it('getJoinableRooms should return the host fallback label when host is missing from the room', () => {
        const room = service.createRoom(hostId, createPayload);
        room.players = [];

        expect(service.getJoinableRooms()).toEqual([
            {
                roomId: room.roomId,
                hostName: 'Organisateur inconnu',
                gameName: createPayload.gameName,
                currentPlayers: 0,
                maxPlayers: 2,
                isLocked: false,
                mode: 'CLASSIC',
            },
        ]);
    });

    it('getJoinableRooms should hide a room once it is marked as started', () => {
        const room = service.createRoom(hostId, createPayload);

        service.markRoomAsStarted(room.roomId);

        expect(service.getJoinableRooms()).toEqual([]);
    });

    it('joinRoom should throw when the game in the room has started', () => {
        const room = service.createRoom(hostId, createPayload);
        service.markRoomAsStarted(room.roomId);

        expect(() => service.joinRoom(secondPlayerId, createJoinPayload('Guest', room.roomId))).toThrow('La partie a deja commence.');
    });
});
