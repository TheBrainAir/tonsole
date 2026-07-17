import { Address } from '@ton/core';
import { TonClient } from '@ton/ton';
import { normalizeRecipient, parseAddress, sameAddress, toFriendly, toRaw } from '../../domain/address.js';
import { generateMnemonic, validateMnemonic } from '../../domain/mnemonic.js';
import { sanitizeOptional, sanitizeText } from '../../domain/sanitize.js';
import { AppError } from '../errors.js';
import type { CreateOpts, SigningContext, TonConnect, WalletEngine } from '../WalletEngine.js';
import type {
  AccountRef,
  Asset,
  AssetDelta,
  Balance,
  ConnectRequest,
  ConnectTxMessage,
  ConnectTxRequest,
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
import { normalizeStoredEvent } from './tonconnect-normalize.js';

/** Jetton display metadata, resolved on demand for the TON Connect preview. */
export interface JettonMetaResolver {
  (master: string): Promise<{ decimals: number; symbol?: string } | undefined>;
}

/** Parse a provider-supplied amount to bigint without throwing (0n on junk). */
function toBigIntSafe(v: string | number | undefined | null): bigint {
  if (v === undefined || v === null) return 0n;
  try {
    if (typeof v === 'number') return Number.isFinite(v) ? BigInt(Math.trunc(v)) : 0n;
    const s = v.trim();
    return /^-?\d+$/.test(s) ? BigInt(s) : 0n;
  } catch {
    return 0n;
  }
}

/** Reject a hung RPC call after `ms` so the UI shows a retriable error, not a spinner forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError('NetworkUnavailable', `${label} timed out after ${Math.round(ms / 1000)}s.`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

const RPC_TIMEOUT_MS = 20_000;
/** Longer cap for broadcast — exceeds one WalletKit send attempt (~30s) before we
 *  surface the honest "may have been submitted" message. */
const BROADCAST_TIMEOUT_MS = 40_000;
/** Short cap for the best-effort jetton-metadata lookup on the approval hot-path. */
const METADATA_TIMEOUT_MS = 6_000;

/** TON network chain ids per the TON Connect / walletkit convention. */
const CHAIN_ID: Record<NetworkId, string> = { mainnet: '-239', testnet: '-3' };
function networkIdFromChainId(chainId: string | undefined): NetworkId | undefined {
  if (chainId === CHAIN_ID.mainnet) return 'mainnet';
  if (chainId === CHAIN_ID.testnet) return 'testnet';
  return undefined;
}

/** Structural subset of WalletKit's TransactionEmulatedPreview that we consume. */
interface RawTransfer {
  amount: string;
  fromAddress?: string;
  toAddress?: string;
  tokenAddress?: string;
  assetType?: string; // 'ton' | 'jetton' | 'nft'
}
interface RawTraceTx {
  totalFees?: string;
  description?: { computePhase?: { exitCode?: number } };
}
interface RawAddressBookEntry {
  address?: string;
  domain?: string;
}
interface RawEmulatedPreview {
  result?: unknown; // 'success' | 'failure'
  error?: unknown;
  moneyFlow?: { ourTransfers?: RawTransfer[]; ourAddress?: string };
  trace?: {
    transactions?: Record<string, RawTraceTx>;
    addressBook?: Record<string, RawAddressBookEntry>;
  };
}

/** Structural subset of WalletKit's SendTransactionRequestEvent that we consume. */
interface RawTxRequestMessage {
  address?: string;
  amount?: string;
  payload?: string;
  stateInit?: string;
}
interface RawTxRequestEvent {
  id: string;
  walletAddress?: string;
  preview: { data?: RawEmulatedPreview };
  request?: {
    messages?: RawTxRequestMessage[];
    network?: { chainId?: string };
    validUntil?: number;
  };
}

function assetTypeOf(item: RawTransfer): 'ton' | 'jetton' | 'nft' {
  if (item.assetType === 'nft') return 'nft';
  if (item.assetType === 'jetton' || item.tokenAddress) return 'jetton';
  return 'ton';
}

/** Find a counterparty's human-readable .ton domain in the emulation address book. */
function lookupName(
  counterparty: string | undefined,
  book?: Record<string, RawAddressBookEntry>,
): string | undefined {
  if (!counterparty || !book) return undefined;
  for (const [key, entry] of Object.entries(book)) {
    try {
      if (sameAddress(key, counterparty) || (entry.address && sameAddress(entry.address, counterparty))) {
        return entry.domain || undefined;
      }
    } catch {
      // non-address key; skip
    }
  }
  return undefined;
}

function extractErrorMessage(error: unknown): string {
  // The emulator's error message is free-form and can echo attacker/on-chain text;
  // it is rendered on the approval surface, so sanitize it like any untrusted string.
  if (error && typeof error === 'object' && 'message' in error) {
    const cleaned = sanitizeText(String((error as { message?: unknown }).message ?? ''), { maxLen: 200 });
    return cleaned === '' ? 'Transaction emulation failed.' : cleaned;
  }
  return 'Transaction emulation failed.';
}

function describeRequestError(event: unknown): string {
  const e = event as { error?: { message?: string }; message?: string } | undefined;
  return e?.error?.message ?? e?.message ?? 'TON Connect request error';
}

interface JettonDisplayMeta {
  decimals: number;
  symbol?: string;
}

/**
 * Map a WalletKit emulated preview into our engine-agnostic TxPreview.
 *
 * `preview` may be undefined/empty when the dApp transaction could not be
 * emulated — in that case `emulated` is false and the UI must warn rather than
 * present an empty money-flow as a safe "no change".
 */
function mapEmulatedPreview(
  preview: RawEmulatedPreview | undefined,
  ourAddress: string,
  metaFor: (jettonMaster: string) => JettonDisplayMeta,
): TxPreview {
  const p = preview ?? {};
  const emulated =
    p.result !== undefined ||
    (p.error !== undefined && p.error !== null) ||
    p.moneyFlow !== undefined ||
    p.trace !== undefined;

  const book = p.trace?.addressBook;
  const outgoing: AssetDelta[] = [];
  const incoming: AssetDelta[] = [];
  for (const item of p.moneyFlow?.ourTransfers ?? []) {
    const amount = toBigIntSafe(item.amount);
    const isOut = item.fromAddress !== undefined && sameAddress(item.fromAddress, ourAddress);
    const type = assetTypeOf(item);
    let asset: Asset;
    if (type === 'ton') {
      asset = 'TON';
    } else if (type === 'nft') {
      asset = { jettonMaster: item.tokenAddress ?? '', decimals: 0 };
    } else {
      const meta = metaFor(item.tokenAddress ?? '');
      asset = { jettonMaster: item.tokenAddress ?? '', decimals: meta.decimals, symbol: meta.symbol };
    }
    const counterparty = isOut ? item.toAddress : item.fromAddress;
    (isOut ? outgoing : incoming).push({
      asset,
      amount: isOut ? -amount : amount,
      counterparty,
      counterpartyName: sanitizeOptional(lookupName(counterparty, book), { maxLen: 64 }),
      assetType: type,
    });
  }

  let feeTotal = 0n;
  let exitCode: number | undefined;
  for (const tx of Object.values(p.trace?.transactions ?? {})) {
    if (tx.totalFees) feeTotal += toBigIntSafe(tx.totalFees);
    const ec = tx.description?.computePhase?.exitCode;
    if (exitCode === undefined && typeof ec === 'number' && ec !== 0) exitCode = ec;
  }

  const failed = p.result === 'failure' || (p.error !== undefined && p.error !== null);
  return {
    // An un-emulated tx is neither "ok" nor "failed": ok is meaningful only when emulated.
    ok: emulated && !failed,
    emulated,
    moneyFlow: { outgoing, incoming },
    estimatedFees: feeTotal > 0n ? { gas: 0n, forward: 0n, storage: 0n, total: feeTotal } : undefined,
    willDeployWallet: false,
    warnings: failed ? [extractErrorMessage(p.error)] : [],
    exitCode,
    raw: p,
  };
}

// @ton/walletkit ships a broken module build whose *named* exports Node cannot
// statically bind and whose internal relative imports raw Node cannot resolve. A
// dynamic import yields the full namespace and works in both runtimes: tsx fixes
// resolution in dev, and tsup bundles @ton/walletkit (noExternal) so esbuild inlines
// and fixes it for the published bin.
// Silence WalletKit's console logger (defaults to ERROR) so its internal logs
// never corrupt the Ink TUI; user-facing errors are surfaced via our handlers.
// Honour an explicit override if the user set one.
process.env.WALLETKIT_LOG_LEVEL ??= 'none';
const wk = await import('@ton/walletkit');

type WalletKitInstance = InstanceType<typeof wk.TonWalletKit>;
type WkNetwork = ReturnType<typeof wk.Network.testnet>;

const TONCONNECT_BRIDGE_URL = 'https://connect.ton.org/bridge';
// @ton/core SendMode.CARRY_ALL_REMAINING_BALANCE — send the entire balance (fees deducted from it).
const SEND_ALL = 128;

const laterMilestone = (feature: string): AppError =>
  new AppError('EngineUnsupported', `${feature} is not implemented yet (coming in a later milestone).`);

export interface WalletKitEngineDeps {
  network: NetworkId;
  toncenterUrl: string;
  toncenterKey?: string;
  /** Optional jetton-metadata resolver so the TON Connect preview can show real
   *  decimals/symbol instead of a hardcoded 9. Wired from the composition root. */
  resolveJettonMeta?: JettonMetaResolver;
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

  /**
   * MemoryStorageAdapter wrapper that rewrites raw → friendly addresses in stored
   * TON Connect transaction requests, so WalletKit's friendly-only validation
   * accepts dApps (e.g. minter.ton.org) that send raw message addresses.
   */
  #normalizingStorage(): InstanceType<typeof wk.MemoryStorageAdapter> {
    const inner = new wk.MemoryStorageAdapter({});
    const testnet = this.#deps.network === 'testnet';
    const wrapper = {
      get: (key: string) => inner.get(key),
      set: (key: string, value: string) => inner.set(key, normalizeStoredEvent(value, testnet)),
      remove: (key: string) => inner.remove(key),
      clear: () => inner.clear(),
    };
    return wrapper as unknown as InstanceType<typeof wk.MemoryStorageAdapter>;
  }

  async init(): Promise<void> {
    // The TON Connect bridge handles SSE via @tonconnect/isomorphic-eventsource,
    // which works under Node on its own — no global EventSource polyfill needed.
    const net = this.#wkNetwork(this.#deps.network);
    this.#kit = new wk.TonWalletKit({
      deviceInfo: wk.createDeviceInfo(),
      walletManifest: wk.createWalletManifest(),
      storage: this.#normalizingStorage(),
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
    const nano = await withTimeout(
      client.getBalance(Address.parse(acct.rawAddress)),
      RPC_TIMEOUT_MS,
      'Balance lookup',
    );
    return { nano, decimals: 9 };
  }

  async resolveName(name: string): Promise<string | null> {
    const client = this.#requireKit().getApiClient(this.#wkNetwork(this.#deps.network));
    const resolved = await client.resolveDnsWallet(name);
    return resolved
      ? toFriendly(parseAddress(String(resolved)), { network: this.#deps.network, bounceable: false })
      : null;
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
              ...(intent.max ? { mode: SEND_ALL } : {}),
            } as Parameters<typeof wallet.createTransferTonTransaction>[0])
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

      const rawPreview = await withTimeout(
        wallet.getTransactionPreview(request),
        RPC_TIMEOUT_MS,
        'Transaction emulation',
      );
      const preview = this.#mapPreview(rawPreview, acct, intent);
      if (!preview.ok) {
        throw new AppError('EmulationFailed', preview.warnings[0] ?? 'Transaction emulation failed.', {
          details: { warnings: preview.warnings },
        });
      }
      if (onPreview && !(await onPreview(preview))) {
        throw new AppError('Cancelled', 'Transfer cancelled.');
      }

      // Broadcast can't be safely cancelled — WalletKit may already have delivered the
      // message to the node when our cap fires. Use a longer cap and, on timeout, say
      // the tx MAY have been submitted (TON external messages are seqno-idempotent, so a
      // later retry cannot double-spend) rather than implying it failed.
      const sent = await withTimeout(
        wallet.sendTransaction(request),
        BROADCAST_TIMEOUT_MS,
        'Broadcast',
      ).catch((e: unknown) => {
        if (AppError.is(e, 'NetworkUnavailable') && e.message.includes('timed out')) {
          throw new AppError(
            'NetworkUnavailable',
            'The network is slow to accept the broadcast. Your transaction MAY already have been submitted — check your history before retrying.',
          );
        }
        throw e;
      });
      return { hash: sent.normalizedHash, status: 'submitted' };
    });
  }

  /** TON sends need enough TON for the amount; jetton sends only need gas (caught by
   *  emulation), and the jetton amount is validated by the service layer. */
  async #preCheckTonBalance(acct: AccountRef, intent: TransferIntent): Promise<void> {
    if (intent.kind !== 'ton' || intent.max) return;
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
    return mapEmulatedPreview(preview, acct.address, (master) => ({
      decimals: intent.kind === 'jetton' && sameAddress(master, intent.jettonMaster) ? intent.decimals : 9,
    }));
  }

  /**
   * Build the engine-agnostic dApp transaction request: resolve real jetton
   * decimals/symbol for the preview, extract the exact messages being signed, and
   * flag a network mismatch — so the approval prompt can never present a false or
   * un-simulated picture of what the user is about to sign.
   */
  async #buildConnectTxRequest(rawEvent: unknown): Promise<ConnectTxRequest> {
    const event = rawEvent as RawTxRequestEvent;
    const ourAddress = this.#tcAccount?.address ?? event.walletAddress ?? '';
    const emulation = event.preview?.data;

    // Resolve display metadata for every jetton in the emulated flow (best-effort).
    const masters = new Set<string>();
    for (const item of emulation?.moneyFlow?.ourTransfers ?? []) {
      if (assetTypeOf(item) === 'jetton' && item.tokenAddress) masters.add(item.tokenAddress);
    }
    const metaByMaster = new Map<string, JettonDisplayMeta>();
    const resolver = this.#deps.resolveJettonMeta;
    if (resolver && masters.size > 0) {
      try {
        // Cap the lookup so a hung/slow indexer can't stall the approval prompt.
        await withTimeout(
          Promise.all(
            [...masters].map(async (master) => {
              const meta = await resolver(master).catch(() => undefined);
              if (meta) metaByMaster.set(master, { decimals: meta.decimals, symbol: meta.symbol });
            }),
          ),
          METADATA_TIMEOUT_MS,
          'Token metadata lookup',
        );
      } catch {
        // Timed out or failed — proceed with whatever resolved; warned below.
      }
    }
    // When a jetton's decimals were guessed (default 9), the amount shown may be wrong.
    const decimalsGuessed = [...masters].some((m) => !metaByMaster.has(m));
    const metaFor = (master: string): JettonDisplayMeta => metaByMaster.get(master) ?? { decimals: 9 };

    const preview = mapEmulatedPreview(emulation, ourAddress, metaFor);
    if (decimalsGuessed) {
      preview.warnings.push(
        'Could not verify the decimals/symbol of one or more tokens — the token amounts shown may be inaccurate. Verify with the dApp before approving.',
      );
    }

    // The exact messages the dApp asked to sign — shown alongside the emulated flow.
    const activeNet = this.#tcAccount?.network ?? this.#deps.network;
    const messages: ConnectTxMessage[] = (event.request?.messages ?? []).map((m) => ({
      to: sanitizeOptional(String(m.address ?? ''), { maxLen: 70 }) ?? '(unknown)',
      amount: toBigIntSafe(m.amount),
      hasPayload: typeof m.payload === 'string' && m.payload.length > 0,
      hasStateInit: typeof m.stateInit === 'string' && m.stateInit.length > 0,
    }));

    // Guard against signing on the wrong chain (M2): re-tagging silently would be worse.
    const reqChainId = event.request?.network?.chainId;
    const reqNet = networkIdFromChainId(reqChainId);
    const networkMismatch =
      reqChainId !== undefined && reqNet !== activeNet
        ? { requested: reqNet ?? reqChainId, active: activeNet }
        : undefined;
    if (networkMismatch) {
      preview.warnings.push(
        `This dApp requested the ${networkMismatch.requested} network but your wallet is on ${activeNet}.`,
      );
    }

    return { id: event.id, preview, messages, validUntil: event.request?.validUntil, networkMismatch };
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
            dappName: sanitizeOptional(event.preview.dAppInfo?.name, { maxLen: 64 }),
            dappUrl: sanitizeOptional(event.preview.dAppInfo?.url, { maxLen: 128 }),
            permissions: event.preview.permissions
              .map((p) => sanitizeOptional(p.title ?? p.name ?? '', { maxLen: 48 }) ?? '')
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
          void this.#buildConnectTxRequest(event)
            .then((req) => handler(req))
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
