import { CARDINAL_NEIGHBOR_OFFSETS, DoorState, GameCell, ObjectId, TileId, getTerrainMovementCost, isTerrainTile } from '@common/game';
import { GameSessionPlayer, GameSessionState, MovePlayerPayload, PerformActionPayload, TeleportPlayerPayload } from '@common/game-session';
import { PlayerType } from '@common/player';
import { RoomState, VirtualPlayerSummary } from '@common/wait-room';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PlayerService {
    createSessionPlayers(room: RoomState, startCells: GameCell[]): GameSessionPlayer[] {
        if (startCells.length < room.players.length) {
            throw new Error('Nombre insuffisant de points de depart pour initialiser tous les joueurs.');
        }

        return room.players.map((player, index) => ({
            id: player.id,
            name: player.name,
            avatar: player.avatar,
            playerType: player.playerType,
            ...(player.playerType === PlayerType.VirtualPlayer && 'playstyle' in player
                ? { playstyle: (player as VirtualPlayerSummary).playstyle }
                : {}),
            maxHealth: player.character.maxHealth,
            health: player.character.health,
            speed: player.character.speed,
            attack: player.character.attack,
            defense: player.character.defense,
            baseAttack: player.character.attack,
            baseDefense: player.character.defense,
            attackDice: player.character.attackDice,
            defenseDice: player.character.defenseDice,
            movementPointsLeft: player.character.movementPointsLeft,
            combatSanctuaryPointsLeft: player.character.combatSanctuaryPointsLeft,
            actionsLeft: player.character.actionsLeft,
            combatsWon: 0,
            turnOrder: index + 1,
            isHost: room.hostId === player.id,
            hasAbandoned: false,
            hasFlag: false,
            spawnPosition: {
                row: startCells[index].row,
                column: startCells[index].column,
            },
            position: {
                row: startCells[index].row,
                column: startCells[index].column,
            },
            // stats de fin de partie
            combatsTotal: 0,
            totalDamageTaken: 0,
            totalDamageDone: 0,
            visitedTiles: [],
            turnPlayed: 0,
        }));
    }

    tryMoveActivePlayer(session: GameSessionState, playerId: string, payload: Pick<MovePlayerPayload, 'row' | 'column'>): boolean {
        const activePlayer = session.players.find((player) => player.id === session.activePlayerId);
        if (!this.isTurnActive(session, playerId, activePlayer)) return false;

        const destinationCell = session.cells.find((cell) => cell.row === payload.row && cell.column === payload.column);
        if (!this.isDestinationReachable(session, activePlayer as GameSessionPlayer, destinationCell, payload)) return false;

        const movementCost = getTerrainMovementCost((destinationCell as GameCell).tile);
        (activePlayer as GameSessionPlayer).position = { row: payload.row, column: payload.column };
        (activePlayer as GameSessionPlayer).movementPointsLeft -= movementCost;
        return true;
    }

    tryTeleportActivePlayer(session: GameSessionState, playerId: string, payload: Pick<TeleportPlayerPayload, 'row' | 'column'>): boolean {
        const activePlayer = session.players.find((player) => player.id === session.activePlayerId);
        if (!this.isTurnActive(session, playerId, activePlayer)) return false;

        const destinationCell = session.cells.find((cell) => cell.row === payload.row && cell.column === payload.column);
        if (!this.isDestinationFreeTerrain(session, destinationCell, payload)) return false;

        (activePlayer as GameSessionPlayer).position = { row: payload.row, column: payload.column };
        return true;
    }

    hasAvailableMove(session: GameSessionState, player: GameSessionPlayer): boolean {
        const neighborCells = CARDINAL_NEIGHBOR_OFFSETS.map((offset) => ({
            row: player.position.row + offset.row,
            column: player.position.column + offset.column,
        }));

        return neighborCells.some((neighbor) => {
            const destinationCell = session.cells.find((cell) => cell.row === neighbor.row && cell.column === neighbor.column);
            return this.isDestinationReachable(session, player, destinationCell, neighbor);
        });
    }

    hasAvailableCombatAction(session: GameSessionState, player: GameSessionPlayer): boolean {
        if (player.actionsLeft <= 0 || player.hasAbandoned) {
            return false;
        }

        const adjacentCells = CARDINAL_NEIGHBOR_OFFSETS.map((offset) => ({
            row: player.position.row + offset.row,
            column: player.position.column + offset.column,
        }));

        return adjacentCells.some((cell) =>
            session.players.some(
                (otherPlayer) =>
                    !otherPlayer.hasAbandoned &&
                    otherPlayer.id !== player.id &&
                    this.arePlayersEnemies(player, otherPlayer) &&
                    otherPlayer.position.row === cell.row &&
                    otherPlayer.position.column === cell.column,
            ),
        );
    }

    tryPerformCombatAction(
        session: GameSessionState,
        playerId: string,
        payload: Pick<PerformActionPayload, 'row' | 'column'>,
    ): GameSessionPlayer | null {
        const activePlayer = session.players.find((player) => player.id === session.activePlayerId);
        if (!activePlayer || !this.isTurnActive(session, playerId, activePlayer)) return null;

        const target = session.players.find(
            (player) =>
                !player.hasAbandoned &&
                player.id !== activePlayer.id &&
                player.position.row === payload.row &&
                player.position.column === payload.column,
        );
        if (!target) return null;

        if (!this.arePlayersEnemies(activePlayer, target)) {
            return null;
        }

        const distance = Math.abs(activePlayer.position.row - payload.row) + Math.abs(activePlayer.position.column - payload.column);
        return distance === 1 ? target : null;
    }

    resetTurnResources(player: GameSessionPlayer, actionsPerTurn: number): void {
        player.actionsLeft = actionsPerTurn;
        player.movementPointsLeft = player.speed;
    }

    private isTurnActive(session: GameSessionState, playerId: string, activePlayer: GameSessionPlayer | undefined): boolean {
        return session.phase === 'turn' && !!activePlayer && activePlayer.id === playerId && !activePlayer.hasAbandoned;
    }

    private isDestinationReachable(
        session: GameSessionState,
        activePlayer: GameSessionPlayer,
        destinationCell: GameCell | undefined,
        payload: Pick<MovePlayerPayload, 'row' | 'column'>,
    ): boolean {
        if (!destinationCell || this.isBlockingTile(destinationCell)) return false;

        const isOccupied = this.isCellOccupied(session, payload.row, payload.column, activePlayer.id);
        if (isOccupied) return false;

        const distance = Math.abs(activePlayer.position.row - payload.row) + Math.abs(activePlayer.position.column - payload.column);
        if (distance !== 1) return false;

        return activePlayer.movementPointsLeft >= getTerrainMovementCost(destinationCell.tile);
    }

    private isBlockingTile(cell: GameCell): boolean {
        return cell.tile === TileId.Wall || (cell.tile === TileId.Door && cell.doorState !== DoorState.Open) || this.isShrineObject(cell.object);
    }

    private isShrineObject(object?: ObjectId): object is ObjectId.Heal | ObjectId.Combat {
        return object === ObjectId.Heal || object === ObjectId.Combat;
    }

    private isDestinationFreeTerrain(
        session: GameSessionState,
        destinationCell: GameCell | undefined,
        payload: Pick<TeleportPlayerPayload, 'row' | 'column'>,
    ): boolean {
        if (!destinationCell || !isTerrainTile(destinationCell.tile) || destinationCell.object !== undefined) {
            return false;
        }

        return !this.isCellOccupied(session, payload.row, payload.column);
    }

    private isCellOccupied(session: GameSessionState, row: number, column: number, excludedPlayerId?: string): boolean {
        return session.players.some(
            (player) => !player.hasAbandoned && player.id !== excludedPlayerId && player.position.row === row && player.position.column === column,
        );
    }

    private arePlayersEnemies(firstPlayer: GameSessionPlayer, secondPlayer: GameSessionPlayer): boolean {
        if (!firstPlayer.team || !secondPlayer.team) {
            return true;
        }

        return firstPlayer.team !== secondPlayer.team;
    }
}
