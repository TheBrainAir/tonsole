import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/config.js';
import type { Config } from '../config/schema.js';
import { ConfigSchema } from '../config/schema.js';
import { AppError } from '../engine/errors.js';
import type { NetworkId } from '../engine/types.js';
import type { WalletEngine } from '../engine/WalletEngine.js';
import { AccountService, walletCountsByNetwork } from './AccountService.js';

// Real V5R1 account (the M0 derivation cross-check vector); `accountFromMeta` parses
// these for real, so a placeholder string would not survive.
const MAINNET_ADDR = 'UQBfBlddiaxlpNgkKlBOvEcBai7TnoaJBq8ROWl8s3ZsifjQ';
const TESTNET_ADDR = '0QBfBlddiaxlpNgkKlBOvEcBai7TnoaJBq8ROWl8s3ZsiUNa';

// Every method under test is keystore + config only — the engine is never reached.
const ENGINE = {} as WalletEngine;

function keystoreJson(id: string, network: NetworkId, address: string): string {
  return JSON.stringify({
    version: 3,
    id,
    address,
    ton: { walletVersion: 'v5r1', workchain: 0, network, address, publicKey: 'deadbeef' },
    crypto: {
      cipher: 'aes-256-gcm',
      cipherparams: { iv: 'a'.repeat(24) },
      ciphertext: 'b'.repeat(64),
      kdf: 'argon2id',
      kdfparams: { salt: 'c'.repeat(32), m: 65536, t: 3, p: 4, dklen: 32 },
    },
  });
}

describe('AccountService network scoping', () => {
  let root: string;
  const savedEnv: Record<string, string | undefined> = {};

  const writeWallet = (id: string, network: NetworkId): void => {
    const dir = join(root, 'tonsole', 'keystore');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const address = network === 'mainnet' ? MAINNET_ADDR : TESTNET_ADDR;
    writeFileSync(join(dir, `${id}.json`), keystoreJson(id, network, address), { mode: 0o600 });
  };

  const service = (network: NetworkId, patch: Partial<Config> = {}): AccountService =>
    new AccountService(ENGINE, ConfigSchema.parse({ network, ...patch }));

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'tonsole-acct-'));
    for (const k of ['XDG_CONFIG_HOME', 'TONSOLE_NETWORK']) savedEnv[k] = process.env[k];
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

  it('lists only the active network, but listAll sees every wallet', () => {
    writeWallet('main-1', 'mainnet');
    writeWallet('test-1', 'testnet');

    const onTestnet = service('testnet');
    expect(onTestnet.list().map((a) => a.id)).toEqual(['test-1']);
    expect(onTestnet.listAll().map((a) => a.id).sort()).toEqual(['main-1', 'test-1']);
  });

  it('refuses a wallet from another network and names the way out', () => {
    writeWallet('test-1', 'testnet');
    try {
      service('mainnet').resolve('test-1');
      expect.unreachable('resolve must not return an off-network wallet');
    } catch (error) {
      expect(AppError.is(error, 'NetworkMismatch')).toBe(true);
      expect((error as AppError).message).toContain('tonsole network use testnet');
    }
  });

  it('reports the other network rather than "no wallets" when only it has any', () => {
    writeWallet('test-1', 'testnet');
    try {
      service('mainnet').resolve();
      expect.unreachable('resolve must not fall through to an off-network wallet');
    } catch (error) {
      expect(AppError.is(error, 'NetworkMismatch')).toBe(true);
      expect((error as AppError).message).toContain('No mainnet wallets');
    }
  });

  it('resolves the only wallet on the active network without a default set', () => {
    writeWallet('main-1', 'mainnet');
    writeWallet('test-1', 'testnet');
    expect(service('mainnet').resolve().id).toBe('main-1');
  });

  it('ignores a default that points at the other network', () => {
    writeWallet('main-1', 'mainnet');
    writeWallet('test-1', 'testnet');
    // Only mainnet is usable, so the testnet default must not make `resolve` throw.
    const svc = service('mainnet', { defaultAccounts: { testnet: 'test-1' } });
    expect(svc.resolve().id).toBe('main-1');
  });

  it('renames a wallet on another network (local metadata, no switch required)', () => {
    writeWallet('test-1', 'testnet');
    const renamed = service('mainnet').rename('test-1', 'cold storage');
    expect(renamed.label).toBe('cold storage');
    // The save must not be followed by a throw — the label has to survive the call.
    expect(service('testnet').list()[0]?.label).toBe('cold storage');
  });

  it('removes a wallet on another network', () => {
    writeWallet('test-1', 'testnet');
    writeWallet('main-1', 'mainnet');
    service('mainnet').remove('test-1');
    expect(service('testnet').listAll().map((a) => a.id)).toEqual(['main-1']);
  });

  it('does not hand a removed testnet default over to a mainnet wallet', () => {
    writeWallet('test-1', 'testnet');
    writeWallet('test-2', 'testnet');
    writeWallet('main-1', 'mainnet');

    // Removing testnet's default while on mainnet must reassign within testnet.
    service('mainnet', { defaultAccounts: { testnet: 'test-1' } }).remove('test-1');

    const saved = JSON.parse(readFileSync(join(root, 'tonsole', 'config.json'), 'utf8')) as {
      defaultAccounts: Record<string, string | undefined>;
    };
    expect(saved.defaultAccounts.testnet).toBe('test-2');
    expect(saved.defaultAccounts.mainnet).toBeUndefined();
  });

  it('clears a network default when its last wallet is removed', () => {
    writeWallet('test-1', 'testnet');
    writeWallet('main-1', 'mainnet');
    service('testnet', { defaultAccounts: { testnet: 'test-1' } }).remove('test-1');

    const svc = service('mainnet');
    expect(svc.listAll().map((a) => a.id)).toEqual(['main-1']);
    expect(svc.resolve().id).toBe('main-1');
  });

  it('setDefault saves per network and drops the pre-0.1 flat default', () => {
    writeWallet('main-1', 'mainnet');
    service('mainnet').setDefault('main-1');

    const saved = JSON.parse(readFileSync(join(root, 'tonsole', 'config.json'), 'utf8')) as {
      defaultAccounts: Record<string, string>;
      defaultAccount?: string;
    };
    expect(saved.defaultAccounts.mainnet).toBe('main-1');
    expect(saved.defaultAccount).toBeUndefined();
  });

  it('preserves a pre-0.1 default on one network when a default is set on another', () => {
    writeWallet('main-1', 'mainnet'); // the legacy flat default
    writeWallet('main-2', 'mainnet');
    writeWallet('test-1', 'testnet');

    // Legacy default points at a mainnet wallet; set a testnet default while on testnet.
    service('testnet', { defaultAccount: 'main-1' }).setDefault('test-1');

    const saved = JSON.parse(readFileSync(join(root, 'tonsole', 'config.json'), 'utf8')) as {
      defaultAccounts: Record<string, string | undefined>;
      defaultAccount?: string;
    };
    expect(saved.defaultAccount).toBeUndefined();
    expect(saved.defaultAccounts.testnet).toBe('test-1');
    // The mainnet default must have been migrated, not dropped.
    expect(saved.defaultAccounts.mainnet).toBe('main-1');
    // And it must still resolve on mainnet, not error on "multiple wallets".
    expect(service('mainnet', { defaultAccounts: saved.defaultAccounts }).resolve().id).toBe('main-1');
  });

  it('honours a pre-0.1 flat default only for its own network', () => {
    writeWallet('test-1', 'testnet');
    writeWallet('test-2', 'testnet');
    writeWallet('main-1', 'mainnet');

    expect(service('testnet', { defaultAccount: 'test-2' }).resolve().id).toBe('test-2');
    // The same legacy value must not select a default on mainnet.
    expect(service('mainnet', { defaultAccount: 'test-2' }).resolve().id).toBe('main-1');
  });

  it('counts wallets per network without an engine', () => {
    writeWallet('main-1', 'mainnet');
    writeWallet('test-1', 'testnet');
    writeWallet('test-2', 'testnet');
    expect(walletCountsByNetwork()).toEqual({ mainnet: 1, testnet: 2 });
  });

  it('still reports "no wallets yet" when there are none at all', () => {
    expect(() => service('testnet').resolve()).toThrow(/No wallets yet/);
    expect(loadConfig().network).toBe('testnet');
  });
});
