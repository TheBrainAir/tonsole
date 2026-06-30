import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'test/**/*.test.ts'],
    // Integration tests that touch testnet are opt-in via TONSOLE_TEST_TESTNET=1.
    exclude: ['node_modules', 'dist', 'spike'],
  },
});
