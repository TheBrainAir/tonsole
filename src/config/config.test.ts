import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configFileNetwork, envNetwork, loadConfig } from './config.js';

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

  it('lets TONSOLE_NETWORK override the saved network', () => {
    writeConfig('{"network":"mainnet"}');
    process.env.TONSOLE_NETWORK = 'testnet';
    expect(loadConfig().network).toBe('testnet');
  });
});

// `network use` writes config.json, but env wins in loadConfig() — so the command can
// only tell the truth about whether a switch took effect by reading the file directly.
describe('configFileNetwork', () => {
  let root: string;
  const savedEnv: Record<string, string | undefined> = {};

  const writeConfig = (contents: string): void => {
    const cfgDir = join(root, 'tonsole');
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(join(cfgDir, 'config.json'), contents);
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'tonsole-cfg-'));
    savedEnv.XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME;
    savedEnv.TONSOLE_NETWORK = process.env.TONSOLE_NETWORK;
    process.env.XDG_CONFIG_HOME = root;
    delete process.env.TONSOLE_NETWORK;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('reports the saved network, ignoring TONSOLE_NETWORK', () => {
    writeConfig('{"network":"mainnet"}');
    process.env.TONSOLE_NETWORK = 'testnet';
    expect(configFileNetwork()).toBe('mainnet');
    expect(envNetwork()).toBe('testnet');
    // The divergence is what `network use` must warn about.
    expect(loadConfig().network).toBe('testnet');
  });

  it('is undefined when nothing is saved', () => {
    expect(configFileNetwork()).toBeUndefined();
    expect(envNetwork()).toBeUndefined();
  });

  it('ignores a junk network in the file rather than reporting it', () => {
    writeConfig('{"network":"not-a-network"}');
    expect(configFileNetwork()).toBeUndefined();
  });

  it('ignores a junk TONSOLE_NETWORK', () => {
    process.env.TONSOLE_NETWORK = 'nope';
    expect(envNetwork()).toBeUndefined();
    expect(loadConfig().network).toBe('testnet');
  });
});
