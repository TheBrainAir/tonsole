import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'spike/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Architectural boundary: the UI/CLI layers may only depend on services,
  // domain, config and shared — never on engine/secret/network implementations
  // or chain/crypto libraries directly. This compiler-enforces the WalletEngine seam.
  {
    files: ['src/tui/**/*.{ts,tsx}', 'src/cli/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/engine/walletkit/**',
                '**/engine/toncore/**',
                '**/secrets/Argon*',
                '**/network/**',
              ],
              message:
                'UI/CLI must go through services and the WalletEngine/Keystore/Indexer ports, not their implementations.',
            },
            {
              group: ['argon2', '@ton/*', '@ton/**'],
              message:
                'UI/CLI must not import chain/crypto libraries directly; use the services layer.',
            },
          ],
        },
      ],
    },
  },
);
