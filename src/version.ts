import pkg from '../package.json' with { type: 'json' };

/**
 * The single source of the version, read from package.json so `--version` can never
 * drift from what npm published. Both esbuild paths (tsx in dev, tsup for dist)
 * inline this import, so no package.json lookup happens at runtime.
 */
export const VERSION: string = pkg.version;
