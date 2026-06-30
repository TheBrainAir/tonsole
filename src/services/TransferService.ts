import { NETWORKS } from '../config/networks.js';
import { isDnsName, sameAddress } from '../domain/address.js';
import { parseAmount } from '../domain/amount.js';
import { AppError } from '../engine/errors.js';
import type { WalletEngine } from '../engine/WalletEngine.js';
import type { NetworkId, SendResult, TxPreview } from '../engine/types.js';
import type { IndexerPort } from '../network/IndexerPort.js';
import type { SecretString } from '../secrets/secret-string.js';
import type { AccountService } from './AccountService.js';

interface BaseSendParams {
  to: string;
  comment?: string;
  /** Sender wallet id/address; defaults to the default wallet. */
  from?: string;
  passphrase: SecretString;
  /** Invoked with the emulated preview; return false to abort before broadcast. */
  confirm: (preview: TxPreview) => Promise<boolean>;
}

export interface SendTonParams extends BaseSendParams {
  /** Amount in nanotons (ignored when sendMax is set). */
  amount?: bigint;
  /** Send the entire balance (minus fees) via send-mode 128. */
  sendMax?: boolean;
}

export interface SendJettonParams extends BaseSendParams {
  /** Jetton master (minter) address. */
  jettonMaster: string;
  /** Human amount string (e.g. "10.5"); parsed with the jetton's own decimals. */
  amount: string;
}

export interface SendNftParams extends BaseSendParams {
  /** NFT item contract address. */
  nftAddress: string;
}

export interface SentResult extends SendResult {
  explorerUrl?: string;
}

/** Orchestrates the send saga across keystore (signing), indexer and engine. */
export class TransferService {
  constructor(
    private readonly engine: WalletEngine,
    private readonly accounts: AccountService,
    private readonly indexer: IndexerPort,
  ) {}

  async sendTon(params: SendTonParams): Promise<SentResult> {
    const stored = this.accounts.resolve(params.from);
    const to = await this.#resolveRecipient(params.to);
    let amount = params.amount ?? 0n;
    if (params.sendMax) {
      amount = (await this.engine.getBalance(stored.account)).nano;
    } else if (params.amount === undefined) {
      throw new AppError('InvalidAmount', 'An amount is required.');
    }
    const ctx = this.accounts.signingContext(stored, params.passphrase);
    const result = await this.#transfer()(
      stored.account,
      { kind: 'ton', to, amount, comment: params.comment, max: params.sendMax },
      ctx,
      params.confirm,
    );
    return this.#withExplorer(result, stored.account.network);
  }

  async sendJetton(params: SendJettonParams): Promise<SentResult> {
    const stored = this.accounts.resolve(params.from);
    const to = await this.#resolveRecipient(params.to);
    const held = (await this.indexer.getJettons(stored.account)).find((j) =>
      sameAddress(j.master, params.jettonMaster),
    );
    if (!held) {
      throw new AppError('InvalidAddress', `This wallet does not hold a jetton with master ${params.jettonMaster}.`);
    }
    const amount = parseAmount(params.amount, held.decimals);
    if (held.amount < amount) {
      throw new AppError('InsufficientBalance', `Insufficient ${held.symbol ?? 'jetton'} balance.`, {
        details: { have: held.amount.toString(), want: amount.toString() },
      });
    }
    const ctx = this.accounts.signingContext(stored, params.passphrase);
    const result = await this.#transfer()(
      stored.account,
      { kind: 'jetton', jettonMaster: held.master, to, amount, decimals: held.decimals, comment: params.comment },
      ctx,
      params.confirm,
    );
    return this.#withExplorer(result, stored.account.network);
  }

  async sendNft(params: SendNftParams): Promise<SentResult> {
    const stored = this.accounts.resolve(params.from);
    const to = await this.#resolveRecipient(params.to);
    const owned = (await this.indexer.getNfts(stored.account)).some((n) =>
      sameAddress(n.address, params.nftAddress),
    );
    if (!owned) {
      throw new AppError('InvalidAddress', `This wallet does not own NFT ${params.nftAddress}.`);
    }
    const ctx = this.accounts.signingContext(stored, params.passphrase);
    const result = await this.#transfer()(
      stored.account,
      { kind: 'nft', nftAddress: params.nftAddress, to, comment: params.comment },
      ctx,
      params.confirm,
    );
    return this.#withExplorer(result, stored.account.network);
  }

  /** Resolve a `.ton`/`.t.me` name to an address; pass through plain addresses. */
  async #resolveRecipient(to: string): Promise<string> {
    if (!isDnsName(to)) return to;
    const resolve = this.engine.resolveName?.bind(this.engine);
    if (!resolve) {
      throw new AppError('EngineUnsupported', 'DNS names are not supported by the active engine.');
    }
    const address = await resolve(to);
    if (!address) throw new AppError('InvalidAddress', `Could not resolve the name "${to}".`);
    return address;
  }

  #transfer(): NonNullable<WalletEngine['transfer']> {
    const fn = this.engine.transfer?.bind(this.engine);
    if (!fn) throw new AppError('EngineUnsupported', 'The active engine cannot send transactions yet.');
    return fn;
  }

  #withExplorer(result: SendResult, network: NetworkId): SentResult {
    const explorerUrl = result.hash ? NETWORKS[network].explorerTx(result.hash) : undefined;
    return { ...result, explorerUrl };
  }
}
