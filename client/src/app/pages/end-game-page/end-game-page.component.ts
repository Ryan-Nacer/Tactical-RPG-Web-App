import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatZoneComponent } from '@app/components/chat-zone/chat-zone.component';
import { ChatSocketService } from 'src/app/services/chat/chat-socket.service';
import { GameJournalComponent } from '@app/components/game-journal/game-journal.component';
import { GamePageStateService } from '@app/services/game-page-state.service';
import { GamePageDisplayService } from '@app/services/game-page-display.service';
import { GamePagePlayerService } from '@app/services/displacement/game-page-player.service';
import { RoomSocketService } from '@app/services/room-socket.service';
import { GameSessionMessage, GameSessionState, DEFAULT_GAME_TURN_COUNTDOWN, GameSessionPlayer } from '@common/game-session';
import { Subscription } from 'rxjs';
import { Mode, ObjectId, TileId } from '@common/game';

const SECONDS_IN_MINUTE = 60;
const PERCENTAGE = 100;
const MILLISECONDS_IN_SECOND = 1000;

@Component({
    selector: 'app-end-game-page',
    imports: [ChatZoneComponent, GameJournalComponent, DecimalPipe],

    templateUrl: './end-game-page.component.html',
    styleUrl: './end-game-page.component.scss',
})
export class EndGamePageComponent implements OnInit, OnDestroy {
    messages: GameSessionMessage[] = [];
    activeMessageTab: 'chat' | 'journal' = 'chat';
    roomId = '';
    currentUserId = '';
    currentUserName = '';

    session: GameSessionState | null = null;
    players: GameSessionPlayer[] = [];

    currentSortColumn: string = '';
    isSortAscending: boolean = true;
    sortedPlayers: GameSessionPlayer[] = [];

    countdownSeconds = DEFAULT_GAME_TURN_COUNTDOWN;
    currentPlayer: GameSessionPlayer | null = null;

    private route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    readonly gamePageStateService = inject(GamePageStateService);
    readonly gamePageDisplayService = inject(GamePageDisplayService);
    readonly roomSocketService = inject(RoomSocketService);
    readonly gamePagePlayerService = inject(GamePagePlayerService);

    readonly chatService = inject(ChatSocketService);

    private readonly subscriptions = new Subscription();

    ngOnInit() {
        const session = this.roomSocketService.currentGameSessionState;
        this.session = session ?? null;
        this.players = this.session?.players ?? [];
        this.sortedPlayers = [...this.players];

        const viewState = this.gamePageStateService.getViewState(this.session, false, false);

        this.messages = viewState.messages;

        const room = this.roomSocketService.currentRoomState;

        this.roomId = this.route.snapshot.queryParamMap.get('room') ?? '';
        this.currentUserId = this.route.snapshot.queryParamMap.get('playerId') ?? '';
        this.currentUserName = room?.players.find((p) => p.id === this.currentUserId)?.name ?? '';

        this.subscriptions.add(
            this.roomSocketService.gameSessionState$.subscribe((newSession) => {
                if (!newSession || newSession.roomId !== this.roomId) return;

                this.session = newSession;
                this.players = newSession.players;
                if (this.currentSortColumn) {
                    this.applySorting();
                } else {
                    this.sortedPlayers = [...this.players];
                }

                const newViewState = this.gamePageStateService.getViewState(newSession, false, false);

                this.messages = newViewState.messages;
                this.countdownSeconds = newViewState.countdownSeconds;

                this.currentPlayer = this.gamePagePlayerService.getCurrentPlayerFromSocket(newSession, this.roomSocketService.socketId);
            }),
        );
    }

    goToHome() {
        this.roomSocketService.leave({ roomId: this.roomId });
        this.roomSocketService.resetRoomState();

        this.router.navigate(['/']);
    }

    getCombatsLost(player: GameSessionPlayer) {
        return (player.combatsTotal ?? 0) - player.combatsWon;
    }

    calculateVisitedTilesPercentage(player: GameSessionPlayer) {
        if (!this.session) {
            return 0;
        }

        const totalTerrainTiles = this.session.cells.filter(
            (cell) => cell.tile === TileId.Base || cell.tile === TileId.Ice || cell.tile === TileId.Water,
        ).length;

        if (!totalTerrainTiles) {
            return 0;
        }

        return ((player.visitedTiles?.length ?? 0) / totalTerrainTiles) * PERCENTAGE;
    }

    calculateGlobalVisitedTilesPercentage(): number {
        if (!this.session) {
            return 0;
        }

        const totalTerrainTiles = this.session.cells.filter(
            (cell) => cell.tile === TileId.Base || cell.tile === TileId.Ice || cell.tile === TileId.Water,
        ).length;

        if (!totalTerrainTiles) {
            return 0;
        }

        const allVisitedTiles = new Set<string>();

        for (const player of this.session.players) {
            for (const tile of player.visitedTiles ?? []) {
                allVisitedTiles.add(tile);
            }
        }

        return (allVisitedTiles.size / totalTerrainTiles) * PERCENTAGE;
    }

    calculateManipulatedDoorPercentage(): number {
        if (!this.session) {
            return 0;
        }

        const doors = this.session.cells.filter((cell) => cell.tile === TileId.Door);

        if (doors.length === 0) {
            return 0;
        }

        const manipulatedDoors = doors.filter((cell) => cell.doorManipulated).length;
        return (manipulatedDoors / doors.length) * PERCENTAGE;
    }

    calculateUsedShrinePercentage(): number {
        if (!this.session) {
            return 0;
        }

        const shrineCells = this.session.cells.filter((cell) => cell.object === ObjectId.Heal || cell.object === ObjectId.Combat);

        const allShrineIds = new Set<string>();
        const usedShrineIds = new Set<string>();

        for (const cell of shrineCells) {
            if (!cell.shrineId) {
                continue;
            }
            allShrineIds.add(cell.shrineId);
            if (cell.shrineUsed) {
                usedShrineIds.add(cell.shrineId);
            }
        }
        if (allShrineIds.size === 0) {
            return 0;
        }

        return (usedShrineIds.size / allShrineIds.size) * PERCENTAGE;
    }

    calculatePlayersFlag(): number {
        if (!this.session) {
            return 0;
        }
        return this.session.players.filter((player) => player.hasHeldFlag).length;
    }

    isCtfMode(): boolean {
        return this.roomSocketService.currentRoomState?.mode === Mode.CTF;
    }

    sortBy(column: string): void {
        if (this.currentSortColumn === column) {
            this.isSortAscending = !this.isSortAscending;
        } else {
            this.currentSortColumn = column;
            this.isSortAscending = true;
        }

        this.applySorting();
    }

    applySorting(): void {
        this.sortedPlayers = [...this.players].sort((a, b) => {
            const valueA = this.getSortValue(a, this.currentSortColumn);
            const valueB = this.getSortValue(b, this.currentSortColumn);

            if (typeof valueA === 'string' && typeof valueB === 'string') {
                const stringResult = valueA.localeCompare(valueB);
                return this.isSortAscending ? stringResult : -stringResult;
            }

            const result = Number(valueA) - Number(valueB);
            return this.isSortAscending ? result : -result;
        });
    }

    getSortValue(player: GameSessionPlayer, column: string): string | number {
        switch (column) {
            case 'name':
                return player.name;

            case 'combatsTotal':
                return player.combatsTotal ?? 0;

            case 'combatsWon':
                return player.combatsWon;

            case 'combatsLost':
                return this.getCombatsLost(player);

            case 'totalDamageTaken':
                return player.totalDamageTaken ?? 0;

            case 'totalDamageDone':
                return player.totalDamageDone ?? 0;

            case 'visitedTiles':
                return this.calculateVisitedTilesPercentage(player);

            default:
                return player.combatsWon;
        }
    }

    getGameDuration(): string {
        if (!this.session?.startTime) {
            return '00:00';
        }

        const endTime = this.session.endTime ?? Date.now();

        const duration = endTime - this.session.startTime;

        const totalSeconds = Math.floor(duration / MILLISECONDS_IN_SECOND);
        const minutes = Math.floor(totalSeconds / SECONDS_IN_MINUTE);
        const seconds = totalSeconds % SECONDS_IN_MINUTE;

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    getTotalTurns(): number {
        return this.players.reduce((total, player) => {
            return total + (player.turnPlayed ?? 0);
        }, 0);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}
