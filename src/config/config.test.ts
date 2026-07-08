import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  let root: string;
  const savedEnv: Record<string, string | undefined> = {};

  const writeConfig = (contents: string): void => {
    const cfgDir = join(root, 'tonsole');
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(join(cfgDir, 'config.json'), contents);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'tonsole-cfg-'));
    for (const k of ['XDG_CONFIG_HOME', 'TONSOLE_NETWORK', 'TONSOLE_ENGINE']) savedEnv[k] = process.env[k];
    process.env.XDG_CONFIG_HOME = root;
    delete process.env.TONSOLE_NETWORK;
    delete process.env.TONSOLE_ENGINE;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('returns defaults when no config file exists', () => {
    const cfg = loadConfig();
    expect(cfg.network).toBe('testnet');
    expect(cfg.engine).toBe('auto');
  });

  it('falls back to defaults (does not throw) on a schema-invalid but valid-JSON config', () => {
    writeConfig('{"network":"not-a-real-network"}');
    expect(() => loadConfig()).not.toThrow();
    expect(loadConfig().network).toBe('testnet');
  });

  it('falls back to defaults on a non-JSON config file', () => {
    writeConfig('this is not json');
    expect(loadConfig().network).toBe('testnet');
  });

  it('loads a valid config file', () => {
    writeConfig('{"network":"mainnet","engine":"walletkit"}');
    const cfg = loadConfig();
    expect(cfg.network).toBe('mainnet');
    expect(cfg.engine).toBe('walletkit');
  });
});
