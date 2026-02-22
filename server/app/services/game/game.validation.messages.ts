export const VALIDATION_MESSAGES = {
    name: {
        required: 'Le nom du jeu est requis.',
        alreadyUsed: 'Le nom est déjà utilisé',
    },
    description: {
        required: 'La description du jeu est requise.',
    },
    door: {
        invalidPlacement: 'Chaque porte doit se retrouver entre deux murs sur un même axe et deux terrain sur l autre axe.',
    },
    grid: {
        empty: 'La grille est vide.',
        invalidSize: 'Taille de la grille invalide.',
        invalidStartPoints: 'Nombre de points de depart invalide',
    },
    terrain: {
        invalidCoverage: 'Plus de 50% de la surface totale de la carte doit etre occupee par des tuiles de terrain (base, glace, eau).',
        inaccessible: 'Certaines tuiles (terrain ou porte) ne sont pas accessibles depuis tous les points de départ.',
    },
    flag: {
        invalidCtf: 'Le drapeau doit etre place une seule fois en mode CTF',
        invalidClassic: 'Le drapeau ne doit pas etre place en mode',
    },
} as const;
