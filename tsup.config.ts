import { defineConfig } from 'tsup';

// Native (argon2) and well-formed peer-shared libs stay external (installed by npm).
// @ton/walletkit is deliberately NOT external: its published build has broken
// extensionless/directory imports that raw Node can't resolve, so we let esbuild
// bundle and fix it. Its well-formed peers (@ton/core/crypto/ton) remain external so
// a single shared instance is used at runtime.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: false,
  shims: false,
  // Provide a real `require` so bundled CJS deps (e.g. tweetnacl -> require('crypto'))
  // work in the ESM output — esbuild's __require delegates to it when defined.
  banner: {
    js: [
      '#!/usr/bin/env node',
      "import { createRequire as __createRequire } from 'node:module';",
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
  external: ['argon2', 'ink', 'react', 'clipboardy', '@ton/core', '@ton/crypto', '@ton/ton'],
  // tsup externalizes package.json deps by default; force-bundle the broken
  // @ton/walletkit (and its transitive deps) so esbuild fixes its internal imports.
  noExternal: ['@ton/walletkit'],
});
