import { loadConfig, resolveApi } from './config/config.js';
import type { Config } from './config/schema.js';
import type { WalletEngine } from './engine/WalletEngine.js';
import type { NetworkId } from './engine/types.js';
import { createEngine } from './engine/factory.js';
import { AccountService } from './services/AccountService.js';
import { BalanceService } from './services/BalanceService.js';
import { ReceiveService } from './services/ReceiveService.js';

export interface App {
  config: Config;
  engine: WalletEngine;
  accounts: AccountService;
  balances: BalanceService;
  receive: ReceiveService;
  dispose(): Promise<void>;
}

export interface BuildAppOptions {
  /** CLI `--network` override, layered on top of config. */
  network?: NetworkId;
}

/**
 * Composition root: resolve config, build the active engine via the factory, and
 * wire the services. The only place implementations are bound to ports — swapping
 * the engine (e.g. WalletKit -> TonCore) happens entirely inside `createEngine`.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<App> {
  const config = loadConfig();
  if (options.network) config.network = options.network;

  const api = resolveApi(config);
  const engine = await createEngine({
    choice: config.engine,
    network: config.network,
    toncenterUrl: api.toncenterUrl,
    toncenterKey: api.toncenterKey,
    logger: { warn: (message) => process.stderr.write(`tonsole: ${message}\n`) },
  });

  return {
    config,
    engine,
    accounts: new AccountService(engine, config),
    balances: new BalanceService(engine),
    receive: new ReceiveService(config),
    dispose: () => engine.dispose(),
  };
}
