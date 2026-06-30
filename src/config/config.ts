import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { NETWORKS } from './networks.js';
import { configDir, configFile } from './paths.js';
import { type Config, ConfigSchema } from './schema.js';

/**
 * Resolve effective config: defaults -> config.json -> environment overrides.
 * CLI flags are layered on top by the cli layer.
 */
export function loadConfig(): Config {
  let fromFile: Record<string, unknown> = {};
  try {
    fromFile = JSON.parse(readFileSync(configFile(), 'utf8')) as Record<string, unknown>;
  } catch {
    // No config file yet -> schema defaults (testnet, auto engine).
  }

  const env: Record<string, unknown> = {};
  const net = process.env.TONSOLE_NETWORK;
  if (net === 'mainnet' || net === 'testnet') env.network = net;
  const eng = process.env.TONSOLE_ENGINE;
  if (eng === 'auto' || eng === 'walletkit' || eng === 'toncore') env.engine = eng;

  return ConfigSchema.parse({ ...fromFile, ...env });
}

export interface ResolvedApi {
  toncenterUrl: string;
  toncenterKey?: string;
  tonapiUrl: string;
  tonapiKey?: string;
}

/** Merge network presets with user/env API overrides for the active network. */
export function resolveApi(config: Config): ResolvedApi {
  const preset = NETWORKS[config.network];
  return {
    toncenterUrl: config.api.toncenter?.url ?? preset.toncenterUrl,
    toncenterKey: config.api.toncenter?.key ?? process.env.TONSOLE_TONCENTER_KEY,
    tonapiUrl: config.api.tonapi?.url ?? preset.tonapiUrl,
    tonapiKey: config.api.tonapi?.key ?? process.env.TONSOLE_TONAPI_KEY,
  };
}

/** Shallow-merge a patch into config.json (creating it with 0600 perms if absent). */
export function saveConfigPatch(patch: Partial<Config>): void {
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(readFileSync(configFile(), 'utf8')) as Record<string, unknown>;
  } catch {
    // no existing config
  }
  mkdirSync(configDir(), { recursive: true, mode: 0o700 });
  writeFileSync(configFile(), `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`, {
    mode: 0o600,
  });
}
