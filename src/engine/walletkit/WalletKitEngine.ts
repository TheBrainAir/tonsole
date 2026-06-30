import { Address } from '@ton/core';
import { TonClient } from '@ton/ton';
import { normalizeRecipient, parseAddress, sameAddress, toFriendly, toRaw } from '../../domain/address.js';
import { generateMnemonic, validateMnemonic } from '../../domain/mnemonic.js';
import { AppError } from '../errors.js';
import type { CreateOpts, SigningContext, TonConnect, WalletEngine } from '../WalletEngine.js';
import type {
  AccountRef,
  Asset,
  AssetDelta,
  Balance,
  ConnectRequest,
  HistoryItem,
  JettonBalance,
  NetworkId,
  Page,
  SendResult,
  SignedTransaction,
  TonConnectSessionInfo,
  TransferIntent,
  TxPreview,
  UnsignedTransfer,
} from '../types.js';

/** Structural subset of WalletKit's TransactionEmulatedPreview that we consume. */
interface RawEmulatedPreview {
  result?: unknown;
  error?: unknown;
  moneyFlow?: {
    ourTransfers?: Array<{
      amount: string;
      fromAddress?: string;
      toAddress?: string;
      tokenAddress?: string;
    }>;
  };
}

function extractErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'emulation error');
  }
  return 'Transaction emulation failed.';
}

function describeRequestError(event: unknown): string {
  const e = event as { error?: { message?: string }; message?: string } | undefined;
  return e?.error?.message ?? e?.message ?? 'TON Connect request error';
}

/** Map a WalletKit emulated preview into our engine-agnostic TxPreview. */
function mapEmulatedPreview(
  preview: RawEmulatedPreview,
  ourAddress: string,
  decimalsFor: (jettonMaster: string) => number,
): TxPreview {
  const outgoing: AssetDelta[] = [];
  const incoming: AssetDelta[] = [];
  for (const item of preview.moneyFlow?.ourTransfers ?? []) {
    const amount = BigInt(item.amount);
    const isOut = item.fromAddress !== undefined && sameAddress(item.fromAddress, ourAddress);
    const asset: Asset = item.tokenAddress
      ? { jettonMaster: item.tokenAddress, decimals: decimalsFor(item.tokenAddress) }
      : 'TON';
    (isOut ? outgoing : incoming).push({
      asset,
      amount: isOut ? -amount : amount,
      counterparty: isOut ? item.toAddress : item.fromAddress,
    });
  }
  const ok = preview.error === undefined || preview.error === null;
  return {
    ok,
    moneyFlow: { outgoing, incoming },
    willDeployWallet: false,
    warnings: ok ? [] : [extractErrorMessage(preview.error)],
    raw: preview,
  };
}

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
  #tcAccount: AccountRef | undefined;
  #tcWalletId: string | undefined;

  constructor(deps: WalletKitEngineDeps) {
    this.#deps = deps;
  }

  #wkNetwork(network: NetworkId): WkNetwork {
    return network === 'testnet' ? wk.Network.testnet() : wk.Network.mainnet();
  }

  async init(): Promise<void> {
    // The TON Connect bridge handles SSE via @tonconnect/isomorphic-eventsource,
    // which works under Node on its own — no global EventSource polyfill needed.
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

  /**
   * Full TON-transfer saga. WalletKit needs the signer-backed wallet throughout, so
   * the order is: fast-fail on balance -> unlock key -> build -> emulate -> `onPreview`
   * confirmation -> broadcast. Nothing is sent until `onPreview` returns true.
   */
  async transfer(
    acct: AccountRef,
    intent: TransferIntent,
    ctx: SigningContext,
    onPreview?: (preview: TxPreview) => Promise<boolean>,
  ): Promise<SendResult> {
    await this.#preCheckTonBalance(acct, intent);

    return ctx.withMnemonic(async (mnemonic): Promise<SendResult> => {
      const wallet = await this.#walletFor(mnemonic, acct);
      const comment = intent.comment === undefined ? {} : { comment: intent.comment };
      const request =
        intent.kind === 'ton'
          ? await wallet.createTransferTonTransaction({
              recipientAddress: normalizeRecipient(intent.to, acct.network),
              transferAmount: intent.amount.toString(),
              ...comment,
            })
          : intent.kind === 'jetton'
            ? await wallet.createTransferJettonTransaction({
                jettonAddress: normalizeRecipient(intent.jettonMaster, acct.network),
                recipientAddress: normalizeRecipient(intent.to, acct.network),
                transferAmount: intent.amount.toString(),
                ...comment,
              })
            : await wallet.createTransferNftTransaction({
                nftAddress: normalizeRecipient(intent.nftAddress, acct.network),
                recipientAddress: normalizeRecipient(intent.to, acct.network),
                ...comment,
              });

      const preview = this.#mapPreview(await wallet.getTransactionPreview(request), acct, intent);
      if (!preview.ok) {
        throw new AppError('EmulationFailed', preview.warnings[0] ?? 'Transaction emulation failed.', {
          details: { warnings: preview.warnings },
        });
      }
      if (onPreview && !(await onPreview(preview))) {
        throw new AppError('Cancelled', 'Transfer cancelled.');
      }

      const sent = await wallet.sendTransaction(request);
      return { hash: sent.normalizedHash, status: 'submitted' };
    });
  }

  /** TON sends need enough TON for the amount; jetton sends only need gas (caught by
   *  emulation), and the jetton amount is validated by the service layer. */
  async #preCheckTonBalance(acct: AccountRef, intent: TransferIntent): Promise<void> {
    if (intent.kind !== 'ton') return;
    const { nano } = await this.getBalance(acct);
    if (nano < intent.amount) {
      throw new AppError(
        'InsufficientBalance',
        `Balance is ${nano} nanotons but ${intent.amount} was requested.`,
        { details: { balance: nano.toString(), amount: intent.amount.toString() } },
      );
    }
  }

  async #walletFor(mnemonic: string[], acct: AccountRef) {
    const kit = this.#requireKit();
    const net = this.#wkNetwork(acct.network);
    const client = kit.getApiClient(net);
    const signer = await wk.Signer.fromMnemonic(mnemonic, { type: 'ton' });
    const adapter =
      acct.version === 'v4r2'
        ? await wk.WalletV4R2Adapter.create(signer, { client, network: net })
        : await wk.WalletV5R1Adapter.create(signer, { client, network: net });
    const wallet = await kit.addWallet(adapter);
    if (!wallet) throw new AppError('Unknown', 'Failed to initialize the wallet for signing.');
    return wallet;
  }

  #mapPreview(preview: RawEmulatedPreview, acct: AccountRef, intent: TransferIntent): TxPreview {
    return mapEmulatedPreview(preview, acct.address, (master) =>
      intent.kind === 'jetton' && sameAddress(master, intent.jettonMaster) ? intent.decimals : 9,
    );
  }

  tonConnect(): TonConnect {
    const kit = this.#requireKit();
    let errorHandler: ((message: string) => void) | undefined;
    const reportError = (e: unknown): void =>
      errorHandler?.(e instanceof Error ? e.message : String(e));
    kit.onRequestError((event) => errorHandler?.(describeRequestError(event)));
    return {
      unlock: async (account, ctx) => {
        await ctx.withMnemonic(async (mnemonic) => {
          const net = this.#wkNetwork(account.network);
          const client = kit.getApiClient(net);
          const signer = await wk.Signer.fromMnemonic(mnemonic, { type: 'ton' });
          const adapter =
            account.version === 'v4r2'
              ? await wk.WalletV4R2Adapter.create(signer, { client, network: net })
              : await wk.WalletV5R1Adapter.create(signer, { client, network: net });
          await kit.addWallet(adapter);
          // The kit keys wallets by getWalletId(); incoming dApp events carry no
          // walletId, so we stamp this one on them before approving.
          this.#tcWalletId = adapter.getWalletId();
        });
        this.#tcAccount = account;
      },
      submitUrl: (url) => kit.handleTonConnectUrl(url),
      onConnectRequest: (handler) => {
        kit.onConnectRequest((event) => {
          if (this.#tcWalletId && !event.walletId) event.walletId = this.#tcWalletId;
          const req: ConnectRequest = {
            id: event.id,
            dappName: event.preview.dAppInfo?.name,
            dappUrl: event.preview.dAppInfo?.url,
            permissions: event.preview.permissions
              .map((p) => p.title ?? p.name ?? '')
              .filter((s) => s.length > 0),
          };
          void handler(req)
            .then(async (ok) => {
              if (ok) await kit.approveConnectRequest(event);
              else await kit.rejectConnectRequest(event, 'Rejected by user');
            })
            .catch(reportError);
        });
      },
      onTransactionRequest: (handler) => {
        kit.onTransactionRequest((event) => {
          if (this.#tcWalletId && !event.walletId) event.walletId = this.#tcWalletId;
          const ourAddress = this.#tcAccount?.address ?? event.walletAddress ?? '';
          const preview = mapEmulatedPreview(event.preview.data ?? {}, ourAddress, () => 9);
          void handler({ id: event.id, preview })
            .then(async (ok) => {
              if (ok) await kit.approveTransactionRequest(event);
              else await kit.rejectTransactionRequest(event, 'Rejected by user');
            })
            .catch(reportError);
        });
      },
      onDisconnect: (handler) => kit.onDisconnect(() => handler()),
      onError: (handler) => {
        errorHandler = handler;
      },
      listSessions: async () => {
        const sessions = await kit.listSessions();
        return sessions.map((s): TonConnectSessionInfo => {
          const sess = s as unknown as { id?: string; name?: string; url?: string; manifestUrl?: string };
          return { id: String(sess.id ?? ''), name: sess.name, url: sess.url ?? sess.manifestUrl };
        });
      },
      disconnect: (sessionId) => kit.disconnect(sessionId),
    };
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
