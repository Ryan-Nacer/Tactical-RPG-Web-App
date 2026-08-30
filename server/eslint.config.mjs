import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import baseConfig from '../eslint.config.basic.mjs';

export default [
    ...baseConfig(tsParser, tsPlugin),
    {
        files: ['**/*.ts'],
        rules: {
            // Ajoutez ici d'autres regles specifiques au serveur au besoin
        },
    },
    {
        files: ['**/*.spec.ts'],
        rules: {
            '@typescript-eslint/no-magic-numbers': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            'complexity': 'off',
            'max-len': 'off',
            'max-lines': 'off',
        },
    },
    {
        files: ['app/services/virtual-player/strategy/strategy.ts'],
        rules: {
            'complexity': 'off',
            'max-len': 'off',
            'max-lines': 'off',
        },
    },
    {
        files: ['app/services/virtual-player/virtual-player.service.ts'],
        rules: {
            'complexity': 'off',
            'max-params': 'off',
        },
    },
];
