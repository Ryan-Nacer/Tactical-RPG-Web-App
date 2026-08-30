import { Injectable } from '@angular/core';
import { ObjectId, TileId } from '@common/game';

const INSPECTION_POPOVER_WIDTH = 240;
const INSPECTION_POPOVER_HEIGHT = 188;
const INSPECTION_POPOVER_MARGIN = 12;

type TileDescription = { label: string; cost: string; effect: string };
type ObjectDescription = { label: string; effect: string };

const TILE_DESCRIPTIONS: Record<TileId, TileDescription> = {
    [TileId.Base]: {
        label: 'Terrain de base',
        cost: '1',
        effect: 'Aucun effet particulier.',
    },
    [TileId.Door]: {
        label: 'Porte',
        cost: '1',
        effect: 'Permet un passage conditionnel selon son etat.',
    },
    [TileId.Ice]: {
        label: 'Glace',
        cost: '0',
        effect: 'Case glissante a cout nul.',
    },
    [TileId.Wall]: {
        label: 'Mur',
        cost: '--',
        effect: 'Bloque le passage.',
    },
    [TileId.Water]: {
        label: 'Eau',
        cost: '2',
        effect: 'Ralentit les deplacements.',
    },
};

const DEFAULT_TILE_DESCRIPTION = TILE_DESCRIPTIONS[TileId.Base];

const OBJECT_DESCRIPTIONS: Partial<Record<ObjectId, ObjectDescription>> = {
    [ObjectId.Start]: {
        label: 'Point de depart',
        effect: 'Case reservee aux positions de depart possibles.',
    },
    [ObjectId.Flag]: {
        label: 'Drapeau',
        effect: 'Objectif de capture et de transfert selon le mode de jeu.',
    },
    [ObjectId.Heal]: {
        label: 'Sanctuaire de soin',
        effect: 'Permet de regagner des points de vie lorsqu il sera utilise.',
    },
    [ObjectId.Combat]: {
        label: 'Sanctuaire de combat',
        effect: 'Apporte un avantage de combat temporaire lorsqu il sera utilise.',
    },
};

const DEFAULT_OBJECT_DESCRIPTION: ObjectDescription = {
    label: 'Objet inconnu',
    effect: 'Aucune information disponible.',
};

@Injectable({
    providedIn: 'root',
})
export class GamePageInspectionService {
    hasInspectionPopover(inspectedCell: { row: number; column: number } | null): boolean {
        return !!inspectedCell;
    }

    describeTile(tile: TileId | undefined): TileDescription {
        return tile ? TILE_DESCRIPTIONS[tile] ?? DEFAULT_TILE_DESCRIPTION : DEFAULT_TILE_DESCRIPTION;
    }

    getObjectLabel(object: ObjectId | undefined): string {
        return object ? this.describeObject(object).label : 'Aucun objet';
    }

    getObjectEffect(object: ObjectId | undefined): string {
        return object ? this.describeObject(object).effect : 'Aucun effet additionnel sur cette case.';
    }

    private describeObject(object: ObjectId): ObjectDescription {
        return OBJECT_DESCRIPTIONS[object] ?? DEFAULT_OBJECT_DESCRIPTION;
    }

    getInspectionPopoverPosition(clientX: number, clientY: number): { left: number; top: number } {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const desiredLeft = clientX + INSPECTION_POPOVER_MARGIN;
        const desiredTop = clientY + INSPECTION_POPOVER_MARGIN;

        return {
            left: Math.max(INSPECTION_POPOVER_MARGIN, Math.min(desiredLeft, viewportWidth - INSPECTION_POPOVER_WIDTH - INSPECTION_POPOVER_MARGIN)),
            top: Math.max(INSPECTION_POPOVER_MARGIN, Math.min(desiredTop, viewportHeight - INSPECTION_POPOVER_HEIGHT - INSPECTION_POPOVER_MARGIN)),
        };
    }
}
