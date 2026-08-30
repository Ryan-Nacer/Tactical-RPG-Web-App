import { Directive, OnDestroy, OnInit } from '@angular/core';
import { GameSessionState } from '@common/game-session';
import { GamePageComponentInteraction } from './game-page.component.interaction';
import { GAME_OVER_REDIRECT_DELAY_MS, GAME_PAGE_RETURN_TO_MAIN_KEY, GameOverStatus } from './game-page.component.state';

@Directive()
export abstract class GamePageComponentLifecycle extends GamePageComponentInteraction implements OnInit, OnDestroy {
    ngOnInit(): void {
        if (this.shouldReturnToMain()) {
            this.roomSocketService.resetRoomState();
            this.navigateToHome();
            return;
        }

        const routeContext = this.gamePageStateService.getRouteContext(this.route.snapshot.queryParamMap);
        this.roomId = routeContext.roomId;
        this.gameId = routeContext.gameId;
        this.currentUserId = routeContext.playerId;

        this.room = this.roomSocketService.currentRoomState;
        this.session = this.roomSocketService.currentGameSessionState;
        this.syncFromSession();
        this.syncCurrentPlayer();
        this.triggerActivePlayerScroll();
        this.updateCurrentUserName();

        this.subscriptions.add(
            this.roomSocketService.roomState$.subscribe((room) => {
                if (!this.gamePageStateService.matchesRoom(room, this.roomId)) {
                    return;
                }

                this.room = room;
                this.updateCurrentUserName();
            }),
        );

        this.subscriptions.add(
            this.roomSocketService.gameSessionState$.subscribe((session) => {
                if (!this.gamePageStateService.matchesSession(session, this.roomId)) {
                    return;
                }

                const previousSession = this.session;
                this.session = session;
                this.syncCombatResultMessage(previousSession, session);
                this.syncFromSession();
                this.syncCurrentPlayer();
                this.triggerActivePlayerScroll();
                this.notifyTurnTransitionIfNeeded();
                this.notifySpectatorCombatIfNeeded(session);
                this.handleGameOver(session);
            }),
        );

        this.subscriptions.add(
            this.roomSocketService.cancelled$.subscribe((payload) => {
                if (payload.roomId !== this.roomId) {
                    return;
                }

                if (this.isGameOverPopupVisible) {
                    return;
                }

                this.showGameOverPopup(payload.message || 'Partie terminee.', 'info', false);
            }),
        );

        this.subscriptions.add(
            this.roomSocketService.flagTransferRequest$.subscribe((payload) => {
                if (payload.roomId !== this.roomId) {
                    return;
                }

                this.pendingFlagTransferRequest = payload;
            }),
        );

        if (!this.gameId) {
            this.errors = this.gamePageStateService.getMissingGameErrors();
            return;
        }

        this.loadGame();
    }

    ngOnDestroy(): void {
        if (!this.isNavigatingToEndGame) {
            this.leaveCurrentRoom();
        }
        if (this.gameOverRedirectTimeout) {
            clearTimeout(this.gameOverRedirectTimeout);
        }
        if (this.combatOverlayUnmountTimeout) {
            clearTimeout(this.combatOverlayUnmountTimeout);
        }
        if (this.combatResultHideTimeout) {
            clearTimeout(this.combatResultHideTimeout);
        }
        this.subscriptions.unsubscribe();
    }

    protected handleBeforeUnload(): void {
        if (!this.roomId) {
            return;
        }

        sessionStorage.setItem(GAME_PAGE_RETURN_TO_MAIN_KEY, 'true');
        if (!this.isGameOverPopupVisible) {
            this.leaveCurrentRoom(true);
        }
    }

    protected override navigateToHome(): void {
        void this.router.navigate(['/'], { replaceUrl: true });
    }

    protected override leaveCurrentRoom(markReturnToMain = false): void {
        if (!this.roomId || this.hasSignaledRoomDeparture) {
            return;
        }

        this.hasSignaledRoomDeparture = true;
        if (markReturnToMain) {
            sessionStorage.setItem(GAME_PAGE_RETURN_TO_MAIN_KEY, 'true');
        }

        this.roomSocketService.leave({ roomId: this.roomId });
    }

    private triggerActivePlayerScroll(): void {
        (this as { scheduleScrollToActivePlayer?: () => void }).scheduleScrollToActivePlayer?.();
    }

    private loadGame(): void {
        this.subscriptions.add(
            this.gameClientService.getGame(this.gameId).subscribe({
                next: (game) => {
                    this.game = this.gamePageStateService.normalizeGame(game);
                },
                error: (error: unknown) => {
                    this.errors = this.gameClientService.extractErrors(error);
                },
            }),
        );
    }

    private updateCurrentUserName(): void {
        if (!this.room || !this.currentUserId) {
            this.currentUserName = '';
            return;
        }

        this.currentUserName = this.room.players.find((player) => player.id === this.currentUserId)?.name ?? '';
    }

    private handleGameOver(session: GameSessionState): void {
        if ((!session.winnerPlayerId && !session.winnerPlayerIds?.length) || this.hasHandledGameOver) {
            return;
        }

        if (session.winnerPlayerIds?.length) {
            this.showTeamGameOverPopup(session);
            return;
        }

        this.showCombatGameOverPopup(session);
    }

    private showTeamGameOverPopup(session: GameSessionState): void {
        const winnerIds = session.winnerPlayerIds;
        if (!winnerIds?.length) {
            return;
        }

        const myId = this.currentUserId ?? this.roomSocketService.socketId;
        if (myId && winnerIds.includes(myId)) {
            this.showGameOverPopup('Votre équipe a remporté la partie.', 'win');
            return;
        }

        const flagBearer = session.players.find((player) => player.id === session.winnerPlayerId);
        const teamLabel = flagBearer?.team ? `L'équipe ${flagBearer.team}` : flagBearer?.name ?? 'Une équipe';
        this.showGameOverPopup(`${teamLabel} remporte la partie.`, 'loss');
    }

    private showCombatGameOverPopup(session: GameSessionState): void {
        const isCurrentPlayerWinner = this.isCurrentPlayerWinner(session.winnerPlayerId);
        if (isCurrentPlayerWinner) {
            this.showGameOverPopup('Vous avez remporté la partie.', 'win');
            return;
        }

        const winner = session.players.find((player) => player.id === session.winnerPlayerId);
        const winnerName = winner?.name ?? 'Un joueur';
        this.showGameOverPopup(`${winnerName} remporte la partie.`, 'loss');
    }

    private showGameOverPopup(message: string, status: GameOverStatus = 'loss', navigateToEndGame = true): void {
        if (this.hasHandledGameOver) {
            return;
        }

        this.hasHandledGameOver = this.isGameOverPopupVisible = true;
        this.gameOverStatus = status;
        this.gameOverPopupMessage = navigateToEndGame ? `${message} Redirection vers la fin de partie...` : message;
        this.gameOverRedirectTimeout = setTimeout(() => {
            if (!navigateToEndGame) {
                this.navigateToHome();
                return;
            }

            this.isNavigatingToEndGame = true;
            this.router.navigate(['/end-game'], {
                queryParams: {
                    room: this.roomId,
                    playerId: this.currentUserId,
                },
            });
        }, GAME_OVER_REDIRECT_DELAY_MS);
    }

    private isCurrentPlayerWinner(winnerPlayerId?: string): boolean {
        const effectiveWinnerId = winnerPlayerId ?? this.session?.winnerPlayerId;
        if (!effectiveWinnerId) {
            return false;
        }

        return effectiveWinnerId === this.currentUserId || effectiveWinnerId === this.roomSocketService.socketId;
    }

    private shouldReturnToMain(): boolean {
        if (sessionStorage.getItem(GAME_PAGE_RETURN_TO_MAIN_KEY) !== 'true') {
            return false;
        }

        sessionStorage.removeItem(GAME_PAGE_RETURN_TO_MAIN_KEY);
        return true;
    }
}
