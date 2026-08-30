import { ObjectId } from '@common/game';
import { GameSessionMessage, GameSessionPlayer, GameSessionState, GridPosition, SanctuaryActionMode } from '@common/game-session';
import { cloneSessionCell, getManhattanDistance, isShrineObject, SessionCell } from '@app/services/game-session/utils/game-session-grid.helper';
import { buildPlayerMessage } from '@app/services/game-session/utils/game-session-message.factory';

const TURN_ORDER_STEP = 1;
const SHRINE_COOLDOWN_TURNS = 3;
const DOUBLE_OR_NOTHING_MULTIPLIER = 2;
const NO_EFFECT_MULTIPLIER = 0;
const DEFAULT_RANDOM_THRESHOLD = 0.5;

export interface GameSessionSanctuaryHooks {
    appendMessage: (session: GameSessionState, message: GameSessionMessage) => void;
}

export class GameSessionSanctuaryService {
    constructor(
        private readonly randomFn: () => number = Math.random,
        private readonly randomThreshold = DEFAULT_RANDOM_THRESHOLD,
    ) {}

    canUseSanctuaryOnCell(session: GameSessionState, activePlayer: GameSessionPlayer, adjacentCell: SessionCell): boolean {
        if (!isShrineObject(adjacentCell.object)) {
            return false;
        }

        const shrineCells = this.getShrineCells(session.cells, adjacentCell);
        if (!this.isAdjacentToShrine(activePlayer, shrineCells) || this.isShrineInactive(shrineCells)) {
            return false;
        }

        if (adjacentCell.object === ObjectId.Combat && activePlayer.combatSanctuaryPointsLeft > 0) {
            return false;
        }

        return true;
    }

    tryUseSanctuary(
        session: GameSessionState,
        activePlayer: GameSessionPlayer,
        target: GridPosition,
        sanctuaryMode: SanctuaryActionMode | undefined,
        hooks: GameSessionSanctuaryHooks,
    ): boolean {
        const clickedCell = session.cells.find((cell) => cell.row === target.row && cell.column === target.column);
        if (!clickedCell || !isShrineObject(clickedCell.object)) {
            return false;
        }

        const shrineCells = this.getShrineCells(session.cells, clickedCell);
        if (!this.isAdjacentToShrine(activePlayer, shrineCells) || this.isShrineInactive(shrineCells) || !sanctuaryMode) {
            return false;
        }

        if (clickedCell.object === ObjectId.Combat && activePlayer.combatSanctuaryPointsLeft > 0) {
            return false;
        }

        const effectMultiplier = this.resolveSanctuaryEffectMultiplier(sanctuaryMode);
        if (clickedCell.object === ObjectId.Heal) {
            this.applyHealSanctuaryEffect(activePlayer, effectMultiplier, sanctuaryMode, session, hooks);
        } else {
            this.applyCombatSanctuaryEffect(activePlayer, effectMultiplier, sanctuaryMode, session, hooks);
        }

        this.setShrineCooldownTurns(session, shrineCells, SHRINE_COOLDOWN_TURNS);

        const updatedClickedCell = session.cells.find((cell) => cell.row === target.row && cell.column === target.column);
        if (!updatedClickedCell) {
            return false;
        }

        const updatedShrineCells = this.getShrineCells(session.cells, updatedClickedCell);
        for (const cell of updatedShrineCells) {
            cell.shrineUsed = true;
        }
        return true;
    }

    advanceShrineCooldowns(session: GameSessionState): void {
        session.cells = session.cells.map((cell) =>
            (cell.shrineCooldownTurns ?? 0) > 0
                ? cloneSessionCell(cell, { shrineCooldownTurns: Math.max(0, (cell.shrineCooldownTurns ?? 0) - 1) })
                : cloneSessionCell(cell),
        );
    }

    progressCombatSanctuaryEffect(activePlayer: GameSessionPlayer): void {
        if (activePlayer.combatSanctuaryPointsLeft <= 0) {
            return;
        }

        activePlayer.combatSanctuaryPointsLeft -= 1;
        if (activePlayer.combatSanctuaryPointsLeft > 0) {
            return;
        }

        activePlayer.attack = activePlayer.baseAttack ?? activePlayer.attack;
        activePlayer.defense = activePlayer.baseDefense ?? activePlayer.defense;
    }

    private getShrineCells(cells: SessionCell[], clickedCell: SessionCell): SessionCell[] {
        if (!clickedCell.shrineId) {
            return [clickedCell];
        }

        return cells.filter((cell) => cell.shrineId === clickedCell.shrineId);
    }

    private isAdjacentToShrine(activePlayer: GameSessionPlayer, shrineCells: SessionCell[]): boolean {
        return shrineCells.some((cell) => getManhattanDistance(activePlayer.position, cell) === TURN_ORDER_STEP);
    }

    private isShrineInactive(shrineCells: SessionCell[]): boolean {
        return shrineCells.some((cell) => (cell.shrineCooldownTurns ?? 0) > 0);
    }

    private resolveSanctuaryEffectMultiplier(mode: SanctuaryActionMode): number {
        if (mode === 'normal') {
            return 1;
        }

        return this.randomFn() < this.randomThreshold ? DOUBLE_OR_NOTHING_MULTIPLIER : NO_EFFECT_MULTIPLIER;
    }

    private applyHealSanctuaryEffect(
        activePlayer: GameSessionPlayer,
        effectMultiplier: number,
        mode: SanctuaryActionMode,
        session: GameSessionState,
        hooks: GameSessionSanctuaryHooks,
    ): void {
        const healedPoints = Math.min(activePlayer.maxHealth - activePlayer.health, 2 * effectMultiplier);
        activePlayer.health += healedPoints;

        const modeLabel = mode === 'double-or-nothing' ? ' en mode double ou rien' : '';
        const outcome =
            effectMultiplier === 0 ? "mais n'obtient aucun soin." : `et recupere ${healedPoints} point${healedPoints > 1 ? 's' : ''} de vie.`;
        hooks.appendMessage(
            session,
            buildPlayerMessage(`${activePlayer.name} utilise un sanctuaire de soin${modeLabel} ${outcome}`, activePlayer, 'sanctuary'),
        );
    }

    private applyCombatSanctuaryEffect(
        activePlayer: GameSessionPlayer,
        effectMultiplier: number,
        mode: SanctuaryActionMode,
        session: GameSessionState,
        hooks: GameSessionSanctuaryHooks,
    ): void {
        const bonus = effectMultiplier;
        activePlayer.combatSanctuaryPointsLeft = bonus > 0 ? 2 : 0;

        if (bonus > 0) {
            activePlayer.attack = (activePlayer.baseAttack ?? activePlayer.attack) + bonus;
            activePlayer.defense = (activePlayer.baseDefense ?? activePlayer.defense) + bonus;
        }

        const modeLabel = mode === 'double-or-nothing' ? ' en mode double ou rien' : '';
        const outcome =
            bonus === 0
                ? "mais n'obtient aucun bonus."
                : `et gagne +${bonus} en attaque et +${bonus} en defense jusqu'a la fin de son prochain tour.`;
        hooks.appendMessage(
            session,
            buildPlayerMessage(`${activePlayer.name} utilise un sanctuaire de combat${modeLabel} ${outcome}`, activePlayer, 'sanctuary'),
        );
    }

    private setShrineCooldownTurns(session: GameSessionState, shrineCells: SessionCell[], shrineCooldownTurns: number): void {
        const shrineKeys = new Set(shrineCells.map((cell) => `${cell.row},${cell.column}`));
        session.cells = session.cells.map((cell) =>
            shrineKeys.has(`${cell.row},${cell.column}`) ? cloneSessionCell(cell, { shrineCooldownTurns }) : cloneSessionCell(cell),
        );
    }
}
