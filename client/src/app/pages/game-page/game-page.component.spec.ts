/* eslint-disable max-lines */
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatSocketService } from '@app/services/chat/chat-socket.service';
import { GameClientService } from '@app/services/game-client.service';
import { NotificationService } from '@app/services/notifications/notification.service';
import { RoomSocketService } from '@app/services/room-socket.service';
import { CombatPosture } from '@common/combat';
import { DoorState, ObjectId, ShrinePart, TileId } from '@common/game';
import { GameSessionState } from '@common/game-session';
import { RoomCancelledPayload, RoomState } from '@common/wait-room';
import { Subject, of } from 'rxjs';
import { GamePageComponent } from './game-page.component';
import {
    ChatSocketServiceStub,
    RoomSocketServiceStub,
    createActivatedRouteStub,
    createChatSocketServiceStub,
    createGameClientServiceSpy,
    createGameSessionState,
    createRoomSocketServiceStub,
    createRoomState,
} from './game-page.component.spec.helpers';

function createShrineCells(object: ObjectId.Heal | ObjectId.Combat, shrineId: string) {
    return [
        { row: 0, column: 1, tile: TileId.Base, object, shrineId, shrinePart: ShrinePart.TopLeft, shrineCooldownTurns: 0 },
        { row: 0, column: 2, tile: TileId.Base, object, shrineId, shrinePart: ShrinePart.TopRight, shrineCooldownTurns: 0 },
        { row: 1, column: 1, tile: TileId.Base, object, shrineId, shrinePart: ShrinePart.BottomLeft, shrineCooldownTurns: 0 },
        { row: 1, column: 2, tile: TileId.Base, object, shrineId, shrinePart: ShrinePart.BottomRight, shrineCooldownTurns: 0 },
    ];
}

const ATTACKER_ATTACK_TOTAL = 9;
const ATTACKER_DEFENSE_TOTAL = 5;
const DEFENDER_ATTACK_TOTAL = 7;
const DEFENDER_DEFENSE_TOTAL = 6;
const ATTACK_BASE = 4;
const DEFENSE_BASE = 4;
const NO_PENALTY = 0;
const ATTACKER_ATTACK_DICE_RESULT = 4;
const DEFENDER_ATTACK_DICE_RESULT = 3;
const DEFENSE_DICE_RESULT = 1;
const TURN_TRANSITION_COUNTDOWN_SECONDS = 3;
const COMBAT_RESULT_AUTO_HIDE_DELAY_MS = 3000;
const GAME_OVER_REDIRECT_DELAY_MS = 5000;

/**
 * Strategie :
 * - tester GamePageComponent comme facade de jeu temps reel qui combine etat de salle,
 *   etat de session et interactions utilisateur cote client
 * - verifier surtout les comportements observables critiques : chargement du contexte,
 *   commandes de jeu, reactions aux erreurs et affichage de l'etat courant
 *
 * Cas limites cibles :
 * - joueur actif different du client
 * - mode debug qui ouvre des actions supplementaires
 * - erreurs ou donnees manquantes qui ne doivent pas laisser la page incoherente
 */
describe('GamePageComponent', () => {
    let component: GamePageComponent;
    let fixture: ComponentFixture<GamePageComponent>;
    let roomSocketServiceStub: RoomSocketServiceStub;
    let routerSpy: jasmine.SpyObj<Router>;
    let gameClientServiceSpy: jasmine.SpyObj<GameClientService>;
    let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
    let chatSocketServiceStub: ChatSocketServiceStub;
    let gameSessionState: ReturnType<typeof createGameSessionState>;
    let sharedRightClickPayload: { shiftKey: boolean; clientX: number; clientY: number };
    let sessionWithDebugMode: ReturnType<typeof createGameSessionState>;
    let sessionWithAlternateActivePlayer: ReturnType<typeof createGameSessionState>;

    beforeEach(async () => {
        sessionStorage.clear();
        gameSessionState = createGameSessionState();
        roomSocketServiceStub = createRoomSocketServiceStub(createRoomState(), gameSessionState);
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        gameClientServiceSpy = createGameClientServiceSpy();
        notificationServiceSpy = jasmine.createSpyObj('NotificationService', ['warning', 'info']);
        chatSocketServiceStub = createChatSocketServiceStub();

        await TestBed.configureTestingModule({
            imports: [GamePageComponent],
            providers: [
                { provide: ActivatedRoute, useValue: createActivatedRouteStub() },
                { provide: Router, useValue: routerSpy },
                { provide: RoomSocketService, useValue: roomSocketServiceStub },
                { provide: GameClientService, useValue: gameClientServiceSpy },
                { provide: NotificationService, useValue: notificationServiceSpy },
                { provide: ChatSocketService, useValue: chatSocketServiceStub },
            ],
        }).compileComponents();
    });

    beforeEach(() => {
        sharedRightClickPayload = { shiftKey: false, clientX: 120, clientY: 140 };
        sessionWithDebugMode = { ...gameSessionState, debugMode: true };
        sessionWithAlternateActivePlayer = {
            ...gameSessionState,
            debugMode: true,
            activePlayerId: 'player-2',
            players: [
                gameSessionState.players[0],
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
            ],
        };

        fixture = TestBed.createComponent(GamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        notificationServiceSpy.info.calls.reset();
        notificationServiceSpy.warning.calls.reset();
    });

    it('requests ending the turn for the active player', () => {
        component.finishTurnEarly();
        expect(roomSocketServiceStub.endTurn).toHaveBeenCalledWith({ roomId: 'ROOM01' });
    });

    it('allows the host to end the active player turn when debug mode is enabled', () => {
        component.session = sessionWithAlternateActivePlayer;
        component.currentPlayer = component.session.players[0];
        component.finishTurnEarly();
        expect(roomSocketServiceStub.endTurn).toHaveBeenCalledWith({ roomId: 'ROOM01' });
    });

    it('does not allow the host to end the turn in debug mode while a combat is active', () => {
        const debugCombatSession: GameSessionState = {
            ...sessionWithAlternateActivePlayer,
            countdownMode: 'combat',
            combatState: {
                attackerId: 'player-2',
                defenderId: 'player-3',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        };
        fixture.destroy();
        roomSocketServiceStub.currentGameSessionState = debugCombatSession;
        roomSocketServiceStub.gameSessionState$ = of(debugCombatSession);
        fixture = TestBed.createComponent(GamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        expect(component.canRequestTurnEnd).toBeFalse();

        const endTurnButton = fixture.nativeElement.querySelector('.end-turn-button') as HTMLButtonElement;
        expect(endTurnButton.disabled).toBeTrue();

        component.finishTurnEarly();

        expect(roomSocketServiceStub.endTurn).not.toHaveBeenCalled();
    });

    it('toggles debug mode with the M key for the host', () => {
        component.onDebugShortcutPressed(new KeyboardEvent('keydown', { key: 'M' }));
        expect(roomSocketServiceStub.toggleDebug).toHaveBeenCalledWith({ roomId: 'ROOM01' });
    });

    it('ignores the M shortcut while typing in an editable field', () => {
        const event = new KeyboardEvent('keydown', { key: 'm' });
        Object.defineProperty(event, 'target', { value: document.createElement('input') });
        component.onDebugShortcutPressed(event);
        expect(roomSocketServiceStub.toggleDebug).not.toHaveBeenCalled();
    });

    it('performs an action on the next selected cell', () => {
        component.session = {
            ...gameSessionState,
            players: [
                gameSessionState.players[0],
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite 1',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
            ],
        };
        component.currentPlayer = component.session.players[0];

        component.toggleActionMode();
        component.onBoardCellClicked({ row: 0, column: 1, tile: TileId.Base });
        expect(roomSocketServiceStub.performAction).toHaveBeenCalledWith({ roomId: 'ROOM01', row: 0, column: 1 });
    });

    it('disables the action button and shows a hint when no immediate action is available', () => {
        const actionButton = fixture.nativeElement.querySelector('.action-button') as HTMLButtonElement;
        const actionHint = fixture.nativeElement.querySelector('.action-button-hint') as HTMLParagraphElement | null;

        expect(component.canPrimeAction).toBeTrue();
        expect(component.canToggleActionButton).toBeFalse();
        expect(component.actionButtonHint).toBe('Aucune action possible pour le moment.');
        expect(actionButton.disabled).toBeTrue();
        expect(actionHint?.textContent?.trim()).toBe('Aucune action possible pour le moment.');
    });

    it('computes adjacent valid action targets when action mode is active', () => {
        component.session = {
            ...gameSessionState,
            players: [
                gameSessionState.players[0],
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite 1',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
                {
                    ...gameSessionState.players[0],
                    id: 'player-3',
                    name: 'Invite 2',
                    isHost: false,
                    position: { row: 2, column: 2 },
                },
            ],
        };
        component.currentPlayer = component.session.players[0];
        component.actionPrimed = true;
        expect(component.actionTargetBoardCells).toEqual([{ row: 0, column: 1 }]);
    });

    it('includes adjacent doors in action targets when action mode is active', () => {
        component.session = {
            ...gameSessionState,
            cells: [
                { row: 0, column: 0, tile: TileId.Base },
                { row: 0, column: 1, tile: TileId.Door, doorState: DoorState.Closed },
            ],
        };
        component.currentPlayer = component.session.players[0];
        component.actionPrimed = true;

        expect(component.actionTargetBoardCells).toEqual([{ row: 0, column: 1 }]);
    });

    it('includes all four shrine cells as action targets when one shrine cell is adjacent', () => {
        component.session = {
            ...gameSessionState,
            cells: [{ row: 0, column: 0, tile: TileId.Base }, ...createShrineCells(ObjectId.Heal, 's1')],
        };
        component.currentPlayer = component.session.players[0];
        component.actionPrimed = true;

        expect(component.actionTargetBoardCells).toEqual([
            { row: 0, column: 1 },
            { row: 0, column: 2 },
            { row: 1, column: 1 },
            { row: 1, column: 2 },
        ]);
    });

    it('marks the action button when an obvious adjacent action is available', () => {
        component.session = {
            ...gameSessionState,
            players: [
                gameSessionState.players[0],
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite 1',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
            ],
        };
        component.currentPlayer = component.session.players[0];

        expect(component.shouldHighlightObviousAction).toBeTrue();
        expect(component.canToggleActionButton).toBeTrue();
        expect(component.actionButtonHint).toBe('');
    });

    it('activates the action button when the flag holder is adjacent to a teammate in CTF', () => {
        component.room = {
            ...roomSocketServiceStub.currentRoomState,
            mode: 'CTF',
        };
        component.session = {
            ...gameSessionState,
            players: [
                {
                    ...gameSessionState.players[0],
                    id: 'player-1',
                    team: 'A',
                    hasFlag: true,
                    position: { row: 0, column: 0 },
                },
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite 1',
                    isHost: false,
                    team: 'A',
                    hasFlag: false,
                    position: { row: 0, column: 1 },
                },
            ],
        };
        component.currentPlayer = component.session.players[0];

        expect(component.canToggleActionButton).toBeTrue();
        expect(component.shouldHighlightObviousAction).toBeTrue();
        expect(component.actionTargetBoardCells).toEqual([]);

        component.actionPrimed = true;

        expect(component.actionTargetBoardCells).toEqual([{ row: 0, column: 1, targetType: 'transfer' }]);
    });

    it('formats the player wins label with singular and plural victory wording', () => {
        expect(component.getCombatWinsLabel(1)).toBe('1 victoire');
        expect(component.getCombatWinsLabel(2)).toBe('2 victoires');
    });

    it('does not animate the action button after action mode is already primed', () => {
        component.session = {
            ...gameSessionState,
            players: [
                gameSessionState.players[0],
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite 1',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
            ],
        };
        component.currentPlayer = component.session.players[0];
        component.actionPrimed = true;

        expect(component.shouldHighlightObviousAction).toBeFalse();
    });

    it('moves the active player with the W key', () => {
        component.onKeyUp(new KeyboardEvent('keyup', { key: 'w' }));
        expect(roomSocketServiceStub.movePlayer).toHaveBeenCalledWith({ roomId: 'ROOM01', row: -1, column: 0 });
    });

    it('keeps movement available after combat ends for the active initiator when movement points remain', () => {
        component.session = {
            ...gameSessionState,
            phase: 'turn',
            countdownMode: 'turn',
            combatState: undefined,
            activePlayerId: 'player-1',
            players: [
                {
                    ...gameSessionState.players[0],
                    id: 'player-1',
                    actionsLeft: 0,
                    movementPointsLeft: 2,
                    position: { row: 0, column: 0 },
                },
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
            ],
        };
        component.currentPlayer = component.session.players[0];

        expect(component.isCombatOverlayVisible).toBeFalse();

        component.onKeyUp(new KeyboardEvent('keyup', { key: 'w' }));

        expect(roomSocketServiceStub.movePlayer).toHaveBeenCalledWith({ roomId: 'ROOM01', row: -1, column: 0 });
    });

    it('does not move the player while the sanctuary choice modal is open', () => {
        component.pendingSanctuaryChoice = { row: 0, column: 1, object: ObjectId.Heal, shrineId: 's1' };

        component.onKeyUp(new KeyboardEvent('keyup', { key: 'w' }));

        expect(roomSocketServiceStub.movePlayer).not.toHaveBeenCalled();
    });

    it('ignores non-WASD keys', () => {
        component.onKeyUp(new KeyboardEvent('keyup', { key: 'x' }));
        expect(roomSocketServiceStub.movePlayer).not.toHaveBeenCalled();
    });

    it('adapts the countdown label during turn transition', () => {
        component.session = {
            ...gameSessionState,
            phase: 'transition',
            countdownMode: 'transition',
            turnRemainingSeconds: TURN_TRANSITION_COUNTDOWN_SECONDS,
        };
        component['syncFromSession']();
        expect(component.countdownLabel).toBe('Prochain tour');
        expect(component.countdownState).toBe('transition');
    });

    it('shows a distinct notification only once at the start of a turn transition', () => {
        component.session = {
            ...gameSessionState,
            phase: 'transition',
            countdownMode: 'transition',
            turnRemainingSeconds: TURN_TRANSITION_COUNTDOWN_SECONDS,
        };

        component['syncFromSession']();
        component['notifyTurnTransitionIfNeeded']();
        component['notifyTurnTransitionIfNeeded']();
        expect(notificationServiceSpy.info).toHaveBeenCalledTimes(1);
        expect(notificationServiceSpy.info).toHaveBeenCalledWith("C'est bientot au tour de Hote.", {
            duration: COMBAT_RESULT_AUTO_HIDE_DELAY_MS,
            horizontalPosition: 'center',
            verticalPosition: 'top',
        });
    });

    it('still shows turn transition notification when combat result modal is visible', () => {
        component.showCombatResultMessage = true;
        component.session = {
            ...sessionWithAlternateActivePlayer,
            phase: 'transition',
            countdownMode: 'transition',
            turnRemainingSeconds: TURN_TRANSITION_COUNTDOWN_SECONDS,
        };

        component['syncFromSession']();
        component['notifyTurnTransitionIfNeeded']();

        expect(notificationServiceSpy.info).toHaveBeenCalledTimes(1);
        expect(notificationServiceSpy.info).toHaveBeenCalledWith("C'est bientot au tour de Invite.", {
            duration: COMBAT_RESULT_AUTO_HIDE_DELAY_MS,
            horizontalPosition: 'center',
            verticalPosition: 'top',
        });
    });

    it('does not show the combat result notification to non-participants', () => {
        component.currentUserId = 'player-3';
        roomSocketServiceStub.socketId = 'player-3';
        component.session = {
            ...gameSessionState,
            combatState: undefined,
            players: [
                {
                    ...gameSessionState.players[0],
                    id: 'player-1',
                    name: 'Hote',
                },
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
            ],
        };

        component['syncCombatResultMessage'](
            {
                ...component.session,
                combatState: {
                    attackerId: 'player-1',
                    defenderId: 'player-2',
                    currentTurnNumber: 1,
                    turnsHistory: [],
                },
            },
            component.session,
        );

        expect(component.showCombatResultMessage).toBeFalse();
        expect(component.combatResultWinnerId).toBe('');
        expect(component.combatResultWinnerName).toBe('');
        expect(notificationServiceSpy.info).not.toHaveBeenCalled();
    });

    it('visually disables the countdown for players outside combat', () => {
        component.session = {
            ...gameSessionState,
            countdownMode: 'combat',
            countdownCombatPlayerIds: ['player-2'],
        };
        component['syncFromSession']();
        expect(component.countdownState).toBe('disabled');
        expect(component.countdownValueLabel).toBe('--');
        expect(component.countdownContextLabel).toBe('Combat en cours');
    });

    it('shows the spectator combat overlay to players who are not involved in the combat', () => {
        const spectatorCombatSession: GameSessionState = {
            ...gameSessionState,
            countdownMode: 'combat',
            players: [
                {
                    ...gameSessionState.players[0],
                    id: 'player-1',
                    name: 'Hote',
                },
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
            ],
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        };
        fixture.destroy();
        roomSocketServiceStub.socketId = 'player-3';
        roomSocketServiceStub.currentGameSessionState = spectatorCombatSession;
        roomSocketServiceStub.gameSessionState$ = of(spectatorCombatSession);
        fixture = TestBed.createComponent(GamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        expect(component.shouldShowCombatSpectatorBanner).toBeTrue();
        expect(component.combatSpectatorBannerLabel).toBe('Combat en cours : Hote contre Invite');
        const spectatorOverlay = fixture.nativeElement.querySelector('.combat-spectator-overlay') as HTMLElement | null;
        expect(spectatorOverlay).not.toBeNull();
        expect(spectatorOverlay?.textContent).toContain('Combat en cours : Hote contre Invite');
    });

    it('shows a warning notification when a combat starts for a spectator', () => {
        roomSocketServiceStub.socketId = 'player-3';

        component['notifySpectatorCombatIfNeeded']({
            ...gameSessionState,
            countdownMode: 'combat',
            players: [
                {
                    ...gameSessionState.players[0],
                    id: 'player-1',
                    name: 'Hote',
                },
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
            ],
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        });

        expect(notificationServiceSpy.warning).toHaveBeenCalledWith('Combat en cours : Hote contre Invite', {
            duration: 4500,
            horizontalPosition: 'center',
            verticalPosition: 'top',
        });
    });

    it('opens an inspection popover on right-clicking a cell', () => {
        component.onBoardCellRightClicked({
            cell: { row: 2, column: 3, tile: TileId.Water, object: ObjectId.Start },
            ...sharedRightClickPayload,
        });
        expect(component.gamePageInspectionService.hasInspectionPopover(component.inspectedCell)).toBeTrue();
        expect(component.inspectionPopoverPosition.left).toBeGreaterThanOrEqual(0);
        expect(component.inspectionPopoverPosition.top).toBeGreaterThanOrEqual(0);
    });

    it('teleports the active player on right click when debug mode is enabled', () => {
        component.session = sessionWithDebugMode;
        component.currentPlayer = component.session.players[0];
        component.onBoardCellRightClicked({
            cell: { row: 2, column: 3, tile: TileId.Base },
            ...sharedRightClickPayload,
        });
        expect(roomSocketServiceStub.teleportPlayer).toHaveBeenCalledWith({ roomId: 'ROOM01', row: 2, column: 3 });
        expect(component.gamePageInspectionService.hasInspectionPopover(component.inspectedCell)).toBeFalse();
    });

    it('opens the sanctuary choice modal instead of immediately performing the action', () => {
        component.session = {
            ...gameSessionState,
            cells: [{ row: 0, column: 0, tile: TileId.Base }, ...createShrineCells(ObjectId.Heal, 's1')],
        };
        component.currentPlayer = component.session.players[0];
        component.actionPrimed = true;

        component.onBoardCellClicked(component.session.cells[3]);

        expect(component.pendingSanctuaryChoice).toEqual({ row: 1, column: 1, object: ObjectId.Heal, shrineId: 's1' });
        expect(roomSocketServiceStub.performAction).not.toHaveBeenCalled();
    });

    it('sends the selected sanctuary mode and clears the modal', () => {
        component.session = {
            ...gameSessionState,
            cells: [{ row: 0, column: 0, tile: TileId.Base }, ...createShrineCells(ObjectId.Combat, 's2')],
        };
        component.currentPlayer = component.session.players[0];
        component.pendingSanctuaryChoice = { row: 1, column: 1, object: ObjectId.Combat, shrineId: 's2' };
        component.actionPrimed = true;

        component.chooseSanctuaryMode('double-or-nothing');

        expect(roomSocketServiceStub.performAction).toHaveBeenCalledWith({
            roomId: 'ROOM01',
            row: 1,
            column: 1,
            sanctuaryMode: 'double-or-nothing',
        });
        expect(component.pendingSanctuaryChoice).toBeNull();
        expect(component.actionPrimed).toBeFalse();
    });

    it('closes the sanctuary choice modal when the turn expires into transition', () => {
        component.session = {
            ...gameSessionState,
            cells: [{ row: 0, column: 0, tile: TileId.Base }, ...createShrineCells(ObjectId.Heal, 's1')],
        };
        component.currentPlayer = component.session.players[0];
        component.actionPrimed = true;
        component.pendingSanctuaryChoice = { row: 1, column: 1, object: ObjectId.Heal, shrineId: 's1' };

        component.session = {
            ...component.session,
            phase: 'transition',
            countdownMode: 'transition',
        };

        component['syncFromSession']();

        expect(component.pendingSanctuaryChoice).toBeNull();
        expect(roomSocketServiceStub.performAction).not.toHaveBeenCalled();
    });

    it('closes the sanctuary choice modal when the active player has no actions left', () => {
        component.session = {
            ...gameSessionState,
            cells: [{ row: 0, column: 0, tile: TileId.Base }, ...createShrineCells(ObjectId.Heal, 's1')],
            players: [
                {
                    ...gameSessionState.players[0],
                    actionsLeft: 0,
                },
            ],
        };
        component.currentPlayer = component.session.players[0];
        component.actionPrimed = true;
        component.pendingSanctuaryChoice = { row: 1, column: 1, object: ObjectId.Heal, shrineId: 's1' };

        component['syncFromSession']();

        expect(component.pendingSanctuaryChoice).toBeNull();
        expect(roomSocketServiceStub.performAction).not.toHaveBeenCalled();
    });

    it('ignores a sanctuary confirmation when the choice is no longer valid', () => {
        component.session = {
            ...gameSessionState,
            phase: 'transition',
            countdownMode: 'transition',
        };
        component.currentPlayer = component.session.players[0];
        component.pendingSanctuaryChoice = { row: 1, column: 1, object: ObjectId.Heal, shrineId: 's1' };

        component.chooseSanctuaryMode('normal');

        expect(roomSocketServiceStub.performAction).not.toHaveBeenCalled();
        expect(component.pendingSanctuaryChoice).toBeNull();
    });

    it('displays the player present on the inspected cell', () => {
        component.session = {
            ...gameSessionState,
            players: [
                ...gameSessionState.players,
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite',
                    isHost: false,
                    position: { row: 2, column: 3 },
                },
            ],
        };

        component.onBoardCellRightClicked({
            cell: { row: 2, column: 3, tile: TileId.Base },
            ...sharedRightClickPayload,
        });
        expect(component.inspectedPlayer?.name).toBe('Invite');
        expect(component.inspectedPlayer?.avatarImageUrl).toMatch(/barbie(-in-game)?\.png/);
    });

    it('allows right-click inspection even when it is not the current player turn', () => {
        component.currentPlayer = gameSessionState.players[0];
        component.session = sessionWithAlternateActivePlayer;
        component.onBoardCellRightClicked({
            cell: { row: 2, column: 3, tile: TileId.Water },
            ...sharedRightClickPayload,
        });
        expect(component.gamePageInspectionService.hasInspectionPopover(component.inspectedCell)).toBeTrue();
    });

    it('shows a personalized game-over message for the winner', () => {
        component['handleGameOver']({
            ...gameSessionState,
            winnerPlayerId: 'player-1',
        });
        expect(component.gameOverPopupMessage).toContain('la partie. Redirection vers la fin de partie...');
        expect(component.isGameOverPopupVisible).toBeTrue();
        expect(component.gameOverStatus).toBe('win');
    });

    it('shows the opponent game-over message when another player wins', () => {
        component.session = {
            ...sessionWithAlternateActivePlayer,
            winnerPlayerId: 'player-2',
        };
        component['handleGameOver'](component.session);
        expect(component.gameOverPopupMessage.startsWith('Invite remporte la partie.')).toBeTrue();
        expect(component.gameOverPopupMessage).toContain('Redirection vers la fin de partie...');
        expect(component.isGameOverPopupVisible).toBeTrue();
        expect(component.gameOverStatus).toBe('loss');
    });

    it('shows the same interruption popup when the host leaves the room', () => {
        const cancelledSubject = new Subject<RoomCancelledPayload>();
        fixture.destroy();
        roomSocketServiceStub.cancelled$ = cancelledSubject.asObservable();

        fixture = TestBed.createComponent(GamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        cancelledSubject.next({
            roomId: 'ROOM01',
            reason: 'hostLeft',
            message: "L'organisateur a quitté la salle.",
        });

        expect(component.isGameOverPopupVisible).toBeTrue();
        expect(component.gameOverStatus).toBe('info');
        expect(component.gameOverPopupMessage).toBe("L'organisateur a quitté la salle.");
    });

    it('returns home instead of navigating to end-game when the host leaves the room', fakeAsync(() => {
        const cancelledSubject = new Subject<RoomCancelledPayload>();
        fixture.destroy();
        roomSocketServiceStub.cancelled$ = cancelledSubject.asObservable();
        routerSpy.navigate.calls.reset();

        fixture = TestBed.createComponent(GamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        cancelledSubject.next({
            roomId: 'ROOM01',
            reason: 'hostLeft',
            message: "L'organisateur a quittÃ© la salle.",
        });

        tick(GAME_OVER_REDIRECT_DELAY_MS);

        expect(routerSpy.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
    }));

    it('renders journal entries with involved player names when the journal tab is selected', () => {
        const room: RoomState = {
            ...roomSocketServiceStub.currentRoomState,
            players: [
                roomSocketServiceStub.currentRoomState.players[0],
                {
                    ...roomSocketServiceStub.currentRoomState.players[0],
                    id: 'player-2',
                    name: 'Invite',
                },
            ],
        };
        const session: GameSessionState = {
            ...gameSessionState,
            players: [
                gameSessionState.players[0],
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
            ],
            messages: [
                {
                    id: 'journal-1',
                    text: 'Le combat commence entre Hote et Invite.',
                    type: 'system',
                    createdAt: '2026-04-10T10:15:30.000Z',
                    eventType: 'combat-start',
                    involvedPlayerIds: ['player-1', 'player-2'],
                },
                {
                    id: 'journal-2',
                    text: 'Attaque de Hote contre Invite : base 4, bonus posture +2, de 4, malus 0, total 10.',
                    type: 'combat',
                    createdAt: '2026-04-10T10:15:31.000Z',
                    eventType: 'combat-round',
                    visibleToPlayerIds: ['player-1', 'player-2'],
                    involvedPlayerIds: ['player-1', 'player-2'],
                },
            ],
        };
        fixture.destroy();
        roomSocketServiceStub.currentRoomState = room;
        roomSocketServiceStub.currentGameSessionState = session;
        roomSocketServiceStub.roomState$ = of(room);
        roomSocketServiceStub.gameSessionState$ = of(session);

        fixture = TestBed.createComponent(GamePageComponent);
        component = fixture.componentInstance;
        component.selectMessagesTab('journal');
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const playerLabels = [...element.querySelectorAll('.message-players')].map((node) => node.textContent?.trim());
        const typeBadges = [...element.querySelectorAll('.message-type-badge')].map((node) => node.textContent?.trim());

        expect(playerLabels).toContain('Joueurs: Hote, Invite');
        expect(typeBadges).toContain('Combat prive');
        expect(typeBadges).toContain('Journal');
        expect(element.textContent).toContain('Le combat commence entre Hote et Invite.');
        expect(element.textContent).toContain('Attaque de Hote contre Invite');
    });

    it('marks refresh as an abandonment during beforeunload', () => {
        component.onBeforeUnload();
        expect(sessionStorage.getItem('game-page-return-to-main')).toBe('true');
        expect(roomSocketServiceStub.leave).toHaveBeenCalledWith({ roomId: 'ROOM01' });
    });

    it('leaves the room when the game page is destroyed by navigation', () => {
        component.ngOnDestroy();

        expect(roomSocketServiceStub.leave).toHaveBeenCalledOnceWith({ roomId: 'ROOM01' });
    });

    it('does not emit leave twice when beforeunload is followed by destroy', () => {
        component.onBeforeUnload();
        component.ngOnDestroy();

        expect(roomSocketServiceStub.leave).toHaveBeenCalledTimes(1);
    });

    it('sends posture selection to room socket when combat overlay is visible', () => {
        component.session = {
            ...gameSessionState,
            countdownMode: 'combat',
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 1,
                turnsHistory: [],
            },
        };

        component.onCombatPostureSelected(CombatPosture.Defensive);

        expect(roomSocketServiceStub.chooseCombatPosture).toHaveBeenCalledWith({
            roomId: 'ROOM01',
            posture: CombatPosture.Defensive,
        });
    });

    it('stores combat result winner data when current player wins a combat but not the full match', () => {
        component['showCombatResult']('player-1', 'Hote', false);

        expect(component.showCombatResultMessage).toBeTrue();
        expect(component.combatResultWinnerId).toBe('player-1');
        expect(component.combatResultWinnerName).toBe('Hote');
        expect(component.combatResultIsGameWinner).toBeFalse();

        const timeout = component['combatResultHideTimeout'];
        if (timeout) {
            clearTimeout(timeout);
            component['combatResultHideTimeout'] = null;
        }
    });

    it('stores combat result winner data when current player reaches match victory', () => {
        component['showCombatResult']('player-1', 'Hote', true);

        expect(component.showCombatResultMessage).toBeTrue();
        expect(component.combatResultWinnerId).toBe('player-1');
        expect(component.combatResultWinnerName).toBe('Hote');
        expect(component.combatResultIsGameWinner).toBeTrue();

        const timeout = component['combatResultHideTimeout'];
        if (timeout) {
            clearTimeout(timeout);
            component['combatResultHideTimeout'] = null;
        }
    });

    it('does not show the combat result modal when the combat also ends the match', () => {
        component.session = {
            ...gameSessionState,
            players: [
                {
                    ...gameSessionState.players[0],
                    id: 'player-1',
                    name: 'Hote',
                    combatsWon: 1,
                },
                {
                    ...gameSessionState.players[1],
                    id: 'player-2',
                    name: 'Invite',
                    combatsWon: 0,
                },
            ],
            winnerPlayerId: 'player-1',
        };

        component['syncCombatResultMessage'](
            {
                ...component.session,
                winnerPlayerId: undefined,
                players: [
                    {
                        ...component.session.players[0],
                        combatsWon: 0,
                    },
                    {
                        ...component.session.players[1],
                        combatsWon: 0,
                    },
                ],
                combatState: {
                    attackerId: 'player-1',
                    defenderId: 'player-2',
                    currentTurnNumber: 1,
                    turnsHistory: [],
                },
            },
            component.session,
        );

        expect(component.showCombatResultMessage).toBeFalse();
        expect(component.combatResultWinnerId).toBe('');
        expect(component.combatResultWinnerName).toBe('');
    });

    it('closes the combat result modal state when close handler is called', () => {
        component.showCombatResultMessage = true;
        component.combatResultWinnerId = 'player-1';
        component.combatResultWinnerName = 'Hote';
        component.combatResultIsGameWinner = true;

        component.onCombatResultCloseRequested();

        expect(component.showCombatResultMessage).toBeFalse();
        expect(component.combatResultWinnerId).toBe('');
        expect(component.combatResultWinnerName).toBe('');
        expect(component.combatResultIsGameWinner).toBeFalse();
    });

    it('auto-hides the combat result modal after the display duration', fakeAsync(() => {
        component['showCombatResult']('player-1', 'Hote', false);
        expect(component.showCombatResultMessage).toBeTrue();

        tick(COMBAT_RESULT_AUTO_HIDE_DELAY_MS);

        expect(component.showCombatResultMessage).toBeFalse();
        expect(component.combatResultWinnerId).toBe('');
        expect(component.combatResultWinnerName).toBe('');
        expect(component.combatResultIsGameWinner).toBeFalse();
    }));

    it('keeps the combat result modal closed after manual hide even after auto-hide delay', fakeAsync(() => {
        component['showCombatResult']('player-1', 'Hote', false);
        expect(component.showCombatResultMessage).toBeTrue();

        component.onCombatResultCloseRequested();
        expect(component.showCombatResultMessage).toBeFalse();

        tick(COMBAT_RESULT_AUTO_HIDE_DELAY_MS);

        expect(component.showCombatResultMessage).toBeFalse();
        expect(component.combatResultWinnerId).toBe('');
        expect(component.combatResultWinnerName).toBe('');
        expect(component.combatResultIsGameWinner).toBeFalse();
    }));

    it('maps attack and defense totals for both players from the latest combat round pair regardless of entry order', () => {
        component.session = {
            ...gameSessionState,
            countdownMode: 'combat',
            players: [
                gameSessionState.players[0],
                {
                    ...gameSessionState.players[0],
                    id: 'player-2',
                    name: 'Invite',
                    isHost: false,
                    position: { row: 0, column: 1 },
                },
            ],
            combatState: {
                attackerId: 'player-1',
                defenderId: 'player-2',
                currentTurnNumber: 2,
                turnsHistory: [
                    {
                        attackerId: 'player-2',
                        defenderId: 'player-1',
                        attackerPosture: CombatPosture.Neutral,
                        attackerAttackBase: 4,
                        attackerAttackPenalty: 0,
                        attackerAttackTotal: DEFENDER_ATTACK_TOTAL,
                        defenderPosture: CombatPosture.Defensive,
                        defenderDefenseBase: 4,
                        defenderDefensePenalty: 0,
                        defenderDefenseTotal: ATTACKER_DEFENSE_TOTAL,
                        damageDealt: 2,
                        defenderHealthAfter: 4,
                        attackerAttackDiceRoll: 3,
                        defenderDefenseDiceRoll: 1,
                        attackerAttackPostureBonus: 0,
                        defenderDefensePostureBonus: 2,
                    },
                    {
                        attackerId: 'player-1',
                        defenderId: 'player-2',
                        attackerPosture: CombatPosture.Offensive,
                        attackerAttackBase: 4,
                        attackerAttackPenalty: 0,
                        attackerAttackTotal: ATTACKER_ATTACK_TOTAL,
                        defenderPosture: CombatPosture.Neutral,
                        defenderDefenseBase: 4,
                        defenderDefensePenalty: 0,
                        defenderDefenseTotal: DEFENDER_DEFENSE_TOTAL,
                        damageDealt: 3,
                        defenderHealthAfter: 3,
                        attackerAttackDiceRoll: 4,
                        defenderDefenseDiceRoll: 1,
                        attackerAttackPostureBonus: 2,
                        defenderDefensePostureBonus: 0,
                    },
                ],
            },
        };

        expect(component.combatOverlayAttackerAttackTotal).toBe(ATTACKER_ATTACK_TOTAL);
        expect(component.combatOverlayAttackerDefenseTotal).toBe(ATTACKER_DEFENSE_TOTAL);
        expect(component.combatOverlayDefenderAttackTotal).toBe(DEFENDER_ATTACK_TOTAL);
        expect(component.combatOverlayDefenderDefenseTotal).toBe(DEFENDER_DEFENSE_TOTAL);
        expect(component.combatOverlayAttackerAttackBase).toBe(ATTACK_BASE);
        expect(component.combatOverlayAttackerAttackPenalty).toBe(NO_PENALTY);
        expect(component.combatOverlayAttackerDefenseBase).toBe(DEFENSE_BASE);
        expect(component.combatOverlayAttackerDefensePenalty).toBe(NO_PENALTY);
        expect(component.combatOverlayAttackerDiceResult).toBe(ATTACKER_ATTACK_DICE_RESULT);
        expect(component.combatOverlayAttackerDefenseDiceResult).toBe(DEFENSE_DICE_RESULT);
        expect(component.combatOverlayDefenderAttackBase).toBe(ATTACK_BASE);
        expect(component.combatOverlayDefenderAttackPenalty).toBe(NO_PENALTY);
        expect(component.combatOverlayDefenderDefenseBase).toBe(DEFENSE_BASE);
        expect(component.combatOverlayDefenderDefensePenalty).toBe(NO_PENALTY);
        expect(component.combatOverlayDefenderDiceResult).toBe(DEFENDER_ATTACK_DICE_RESULT);
        expect(component.combatOverlayDefenderDefenseDiceResult).toBe(DEFENSE_DICE_RESULT);
    });

    it('redirects to home if the page was refreshed during the match', () => {
        sessionStorage.setItem('game-page-return-to-main', 'true');
        const refreshedFixture = TestBed.createComponent(GamePageComponent);
        refreshedFixture.detectChanges();
        expect(roomSocketServiceStub.resetRoomState).toHaveBeenCalled();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
        expect(sessionStorage.getItem('game-page-return-to-main')).toBeNull();
    });
});
