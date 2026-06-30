import type { EngineChoice } from '../config/schema.js';
import type { NetworkId } from './types.js';
import type { WalletEngine } from './WalletEngine.js';
import { TonCoreEngine } from './toncore/TonCoreEngine.js';
import { WalletKitEngine } from './walletkit/WalletKitEngine.js';

export interface EngineFactoryDeps {
  choice: EngineChoice;
  network: NetworkId;
  toncenterUrl: string;
  toncenterKey?: string;
  logger?: { warn: (message: string) => void };
}

/**
 * Build and initialize the active engine. `auto` prefers WalletKit (the M0 spike
 * proved it runs under Node) and transparently falls back to TonCore on init
 * failure — the single place where the engine swap happens.
 */
export async function createEngine(deps: EngineFactoryDeps): Promise<WalletEngine> {
  const base = {
    network: deps.network,
    toncenterUrl: deps.toncenterUrl,
    toncenterKey: deps.toncenterKey,
  };

  if (deps.choice === 'toncore') {
    const engine = new TonCoreEngine(base);
    await engine.init();
    return engine;
  }

  if (deps.choice === 'walletkit') {
    const engine = new WalletKitEngine(base);
    await engine.init();
    return engine;
  }

  // auto
  const walletkit = new WalletKitEngine(base);
  try {
    await walletkit.init();
    return walletkit;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    deps.logger?.warn(`WalletKit engine unavailable under Node; falling back to TonCore. (${message})`);
    const fallback = new TonCoreEngine(base);
    await fallback.init();
    return fallback;
  }
}
