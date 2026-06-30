import { Address } from '@ton/core';
import { TonClient } from '@ton/ton';
import { parseAddress, toFriendly, toRaw } from '../../domain/address.js';
import { generateMnemonic, validateMnemonic } from '../../domain/mnemonic.js';
import { AppError } from '../errors.js';
import type { CreateOpts, WalletEngine } from '../WalletEngine.js';
import type {
  AccountRef,
  Balance,
  HistoryItem,
  JettonBalance,
  NetworkId,
  Page,
  SendResult,
  SignedTransaction,
  TxPreview,
  UnsignedTransfer,
} from '../types.js';

// @ton/walletkit ships a broken module build whose *named* exports Node cannot
// statically bind and whose internal relative imports raw Node cannot resolve. A
// dynamic import yields the full namespace and works in both runtimes: tsx fixes
// resolution in dev, and tsup bundles @ton/walletkit (noExternal) so esbuild inlines
// and fixes it for the published bin. See spike/FINDINGS.md.
const wk = await import('@ton/walletkit');

type WalletKitInstance = InstanceType<typeof wk.TonWalletKit>;
type WkNetwork = ReturnType<typeof wk.Network.testnet>;

const TONCONNECT_BRIDGE_URL = 'https://connect.ton.org/bridge';

const laterMilestone = (feature: string): AppError =>
  new AppError('EngineUnsupported', `${feature} is not implemented yet (coming in a later milestone).`);

export interface WalletKitEngineDeps {
  network: NetworkId;
  toncenterUrl: string;
  toncenterKey?: string;
}

/**
 * Primary engine, backed by @ton/walletkit. The M0 spike verified this loads and
 * runs under Node. Reads of TON balance go through @ton/ton's TonClient (a public,
 * address-only query needing no signer).
 */
export class WalletKitEngine implements WalletEngine {
  readonly id = 'walletkit' as const;
  readonly #deps: WalletKitEngineDeps;
  #kit: WalletKitInstance | undefined;
  #client: TonClient | undefined;

  constructor(deps: WalletKitEngineDeps) {
    this.#deps = deps;
  }

  #wkNetwork(network: NetworkId): WkNetwork {
    return network === 'testnet' ? wk.Network.testnet() : wk.Network.mainnet();
  }

  async init(): Promise<void> {
    const net = this.#wkNetwork(this.#deps.network);
    this.#kit = new wk.TonWalletKit({
      deviceInfo: wk.createDeviceInfo(),
      walletManifest: wk.createWalletManifest(),
      storage: new wk.MemoryStorageAdapter({}),
      networks: {
        [net.chainId]: {
          apiClient: { url: this.#deps.toncenterUrl, key: this.#deps.toncenterKey },
        },
      },
      bridge: { bridgeUrl: TONCONNECT_BRIDGE_URL },
    });
    await this.#kit.waitForReady();
    this.#client = new TonClient({
      endpoint: `${this.#deps.toncenterUrl}/api/v2/jsonRPC`,
      apiKey: this.#deps.toncenterKey,
    });
  }

  async dispose(): Promise<void> {
    await this.#kit?.close();
    this.#kit = undefined;
    this.#client = undefined;
  }

  generateMnemonic(): Promise<string[]> {
    return generateMnemonic();
  }

  validateMnemonic(words: string[]): Promise<boolean> {
    return validateMnemonic(words);
  }

  async deriveAccount(mnemonic: string[], opts: CreateOpts): Promise<AccountRef> {
    const kit = this.#requireKit();
    const version = opts.version ?? 'v5r1';
    const net = this.#wkNetwork(opts.network);
    const client = kit.getApiClient(net);
    const signer = await wk.Signer.fromMnemonic(mnemonic, { type: 'ton' });
    const adapter =
      version === 'v4r2'
        ? await wk.WalletV4R2Adapter.create(signer, { client, network: net })
        : await wk.WalletV5R1Adapter.create(signer, { client, network: net });
    const address = parseAddress(String(adapter.getAddress({ testnet: opts.network === 'testnet' })));
    return {
      address: toFriendly(address, { network: opts.network, bounceable: false }),
      rawAddress: toRaw(address),
      workchain: opts.workchain ?? address.workChain,
      version,
      publicKey: String(adapter.publicKey).replace(/^0x/, ''),
      network: opts.network,
    };
  }

  async getBalance(acct: AccountRef): Promise<Balance> {
    const client = this.#requireClient();
    const nano = await client.getBalance(Address.parse(acct.rawAddress));
    return { nano, decimals: 9 };
  }

  async getJettons(): Promise<JettonBalance[]> {
    throw laterMilestone('Jetton balances');
  }

  async getHistory(): Promise<Page<HistoryItem>> {
    throw laterMilestone('Transaction history');
  }

  async buildTransfer(): Promise<UnsignedTransfer> {
    throw laterMilestone('Transfers');
  }

  async preview(): Promise<TxPreview> {
    throw laterMilestone('Emulation');
  }

  async sign(): Promise<SignedTransaction> {
    throw laterMilestone('Signing');
  }

  async send(): Promise<SendResult> {
    throw laterMilestone('Sending');
  }

  #requireKit(): WalletKitInstance {
    if (!this.#kit) {
      throw new AppError('EngineUnsupported', 'Engine not initialized — call init() first.');
    }
    return this.#kit;
  }

  #requireClient(): TonClient {
    if (!this.#client) {
      throw new AppError('EngineUnsupported', 'Engine not initialized — call init() first.');
    }
    return this.#client;
  }
}
