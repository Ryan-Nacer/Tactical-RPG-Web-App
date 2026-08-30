export const VALIDATION_MESSAGES = {
    name: {
        required: 'Le nom du jeu est requis.',
        alreadyUsed: 'Le nom est deja utilise',
    },
    description: {
        required: 'La description du jeu est requise.',
    },
    door: {
        invalidPlacement:
            'Chaque porte doit se retrouver entre deux murs sur un meme axe et deux terrain sur l autre axe, sans etre placee sur le bord.',
    },
    grid: {
        empty: 'La grille est vide.',
        invalidSize: 'Taille de la grille invalide.',
        invalidStartPoints: 'Nombre de points de depart invalide',
    },
    terrain: {
        invalidCoverage: 'Plus de 50% de la surface totale de la carte doit etre occupee par des tuiles de terrain (base, glace, eau).',
        inaccessible: 'Certaines tuiles (terrain ou porte) ne sont pas accessibles depuis tous les points de depart.',
    },
    flag: {
        invalidCtf: 'Le drapeau doit etre place une seule fois en mode CTF',
        invalidClassic: 'Le drapeau ne doit pas etre place en mode',
    },
    shrine: {
        invalidPlacement:
            'Chaque sanctuaire doit occuper exactement 4 cases de terrain adjacentes en 2x2 avec un shrineId et des shrinePart coherents.',
        invalidLimit: 'Le nombre total de sanctuaires depasse la limite permise pour la taille de grille.',
        inaccessible: 'Chaque sanctuaire doit etre accessible depuis au moins une case atteignable.',
    },
} as const;
