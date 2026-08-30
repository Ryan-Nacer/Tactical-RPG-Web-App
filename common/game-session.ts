import { CombatPosture, CombatState } from './combat';
import { GameCell, GridSize } from './game';
import { PlayerAvatar, PlayerType } from './player';
import type { Playstyle } from './wait-room';

// DOUBLE DEFINITION
export type GameDice = 'D4' | 'D6';
export const DEFAULT_GAME_TURN_COUNTDOWN = 30;
export const DEFAULT_GAME_TURN_TRANSITION_COUNTDOWN = 3;
export type SanctuaryActionMode = 'normal' | 'double-or-nothing';

export type GameSessionPhase = 'turn' | 'transition';
export type GameSessionCountdownMode = 'turn' | 'transition' | 'combat' | 'disabled';
export type CTFTeam = 'A' | 'B';

export enum GameSessionEvents {
    State = 'state',
    EndTurn = 'end-turn',
    MovePlayer = 'move-player',
    TeleportPlayer = 'teleport-player',
    PerformAction = 'perform-action',
    ToggleDebug = 'toggle-debug',
    FlagTransferRequest = 'flag-transfer-request',
    FlagTransferResponse = 'flag-transfer-response',
    CombatStart = 'combat-start',
    CombatChoosePosture = 'combat-choose-posture',
    CombatTurnResolved = 'combat-turn-resolved',
    CombatEnd = 'combat-end',
}

export type GameMessageType = 'system' | 'player' | 'combat';
export type GameJournalAudience = 'all' | 'players';
export type GameJournalEventType =
    | 'game-start'
    | 'team-assignment'
    | 'turn-start'
    | 'turn-end'
    | 'combat-start'
    | 'combat-round'
    | 'combat-end'
    | 'door'
    | 'sanctuary'
    | 'debug'
    | 'abandon'
    | 'flag'
    | 'game-end'
    | 'generic';

export interface GameSessionMessage {
    id: string;
    text: string;
    type: GameMessageType;
    createdAt: string;
    authorPlayerId?: string;
    authorName?: string;
    eventType?: GameJournalEventType;
    audience?: GameJournalAudience;
    visibleToPlayerIds?: string[];
    involvedPlayerIds?: string[];
}

export interface GridPosition {
    row: GameCell['row'];
    column: GameCell['column'];
}

export interface GameSessionPlayer {
    id: string;
    name: string;
    avatar: PlayerAvatar;
    playerType: PlayerType;
    /** Présent uniquement pour les joueurs virtuels (profil choisi en salle d’attente). */
    playstyle?: Playstyle;
    maxHealth: number;
    health: number;
    speed: number;
    attack: number;
    defense: number;
    baseAttack?: number;
    baseDefense?: number;
    attackDice: GameDice;
    defenseDice: GameDice;
    movementPointsLeft: number;
    combatSanctuaryPointsLeft: number;
    actionsLeft: number;
    combatsWon: number;
    turnOrder: number;
    isHost: boolean;
    hasAbandoned: boolean;
    hasFlag?: boolean;
    team?: CTFTeam;
    spawnPosition?: GridPosition;
    position: GridPosition;

    //stats end 
    combatsTotal?: number;
    totalDamageTaken?: number;
    totalDamageDone?: number;
    visitedTiles?: string[];
    turnPlayed?: number;
    hasHeldFlag?: boolean;
    //
}

export interface GameSessionState {
    sessionId: string;
    roomId: string;
    gameId: string;
    gridSize: GridSize;
    cells: GameCell[];
    players: GameSessionPlayer[];
    activePlayerId: string;
    phase: GameSessionPhase;
    countdownMode: GameSessionCountdownMode;
    countdownCombatPlayerIds: string[];
    turnRemainingSeconds: number;
    debugMode: boolean;
    combatState?: CombatState;
    winnerPlayerId?: string;
    winnerPlayerIds?: string[];
    messages: GameSessionMessage[];
    // pour statistiques globales 
    startTime?: number;
    endTime?: number;
    
    //
}

export interface EndTurnPayload {
    roomId: string;
}

export interface PerformActionPayload {
    roomId: string;
    row: number;
    column: number;
    sanctuaryMode?: SanctuaryActionMode;
}

export interface MovePlayerPayload {
    roomId: string;
    row: number;
    column: number;
}

export interface TeleportPlayerPayload {
    roomId: string;
    row: number;
    column: number;
}

export interface ToggleDebugPayload {
    roomId: string;
}

export interface FlagTransferRequestPayload {
    roomId: string;
    initiatorId: string;
    initiatorName: string;
}

export interface FlagTransferResponsePayload {
    roomId: string;
    accepted: boolean;
}

export interface CombatChoosePosturePayload {
    roomId: string;
    posture: CombatPosture;
}

export interface CombatEndPayload {
    roomId: string;
    attackerId: string;
    defenderId: string;
    winnerId?: string;
    loserId?: string;
    isTie: boolean;
    reason: 'knockout' | 'tie' | 'abandon' | 'game-over';
}
