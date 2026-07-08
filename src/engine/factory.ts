import type { EngineChoice } from '../config/schema.js';
import { AppError } from './errors.js';
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
  /** Jetton-metadata resolver for the TON Connect preview (WalletKit engine only). */
  resolveJettonMeta?: (master: string) => Promise<{ decimals: number; symbol?: string } | undefined>;
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
    resolveJettonMeta: deps.resolveJettonMeta,
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

  // auto: prefer WalletKit. The TonCore engine is currently a stub that throws on
  // reads/derivation, so a silent fallback would "load" then fail on every action.
  // Surface the real WalletKit failure instead of degrading to a broken engine.
  const walletkit = new WalletKitEngine(base);
  try {
    await walletkit.init();
    return walletkit;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    deps.logger?.warn(`WalletKit engine failed to initialize. (${message})`);
    throw new AppError(
      'EngineUnsupported',
      `The wallet engine could not start: ${message}. Check your network/API settings and try again.`,
      { cause },
    );
  }
}
