import { loadConfig, resolveApi } from './config/config.js';
import type { Config } from './config/schema.js';
import type { WalletEngine } from './engine/WalletEngine.js';
import type { NetworkId } from './engine/types.js';
import { createEngine } from './engine/factory.js';
import { TonApiClient } from './network/tonapi/TonApiClient.js';
import { AccountService } from './services/AccountService.js';
import { BalanceService } from './services/BalanceService.js';
import { HistoryService } from './services/HistoryService.js';
import { ReceiveService } from './services/ReceiveService.js';
import { TransferService } from './services/TransferService.js';

export interface App {
  config: Config;
  engine: WalletEngine;
  accounts: AccountService;
  balances: BalanceService;
  receive: ReceiveService;
  transfers: TransferService;
  history: HistoryService;
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

  const accounts = new AccountService(engine, config);
  const indexer = new TonApiClient(api.tonapiUrl, api.tonapiKey);
  return {
    config,
    engine,
    accounts,
    balances: new BalanceService(engine, indexer),
    receive: new ReceiveService(config),
    transfers: new TransferService(engine, accounts, indexer),
    history: new HistoryService(indexer),
    dispose: () => engine.dispose(),
  };
}
