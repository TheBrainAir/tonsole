import { saveConfigPatch } from '../config/config.js';
import type { Config } from '../config/schema.js';
import { parseAddress, toRaw } from '../domain/address.js';
import { normalizeMnemonic } from '../domain/mnemonic.js';
import { AppError } from '../engine/errors.js';
import type { SigningContext, WalletEngine } from '../engine/WalletEngine.js';
import type { AccountRef, WalletVersion } from '../engine/types.js';
import { type KeystoreTonMeta, decryptKeystore, encryptKeystore } from '../secrets/ArgonKeystore.js';
import { deleteKeystore, findKeystore, listKeystores, saveKeystore } from '../secrets/keystore-file.js';
import type { SecretString } from '../secrets/secret-string.js';

export interface StoredAccount {
  id: string;
  account: AccountRef;
  isDefault: boolean;
  label?: string;
}

function accountFromMeta(meta: KeystoreTonMeta): AccountRef {
  return {
    address: meta.address,
    rawAddress: toRaw(parseAddress(meta.address)),
    workchain: meta.workchain,
    version: meta.walletVersion,
    publicKey: meta.publicKey,
    network: meta.network,
  };
}

/**
 * Create/import/list/select wallets. Binds the keystore (encryption at rest) to the
 * engine (key derivation). The plaintext mnemonic only exists transiently here.
 */
export class AccountService {
  constructor(
    private readonly engine: WalletEngine,
    private readonly config: Config,
  ) {}

  /** Generate a new wallet. Returns the mnemonic so the caller can show it ONCE. */
  async create(
    passphrase: SecretString,
    opts?: { version?: WalletVersion },
  ): Promise<{ account: AccountRef; mnemonic: string[]; id: string }> {
    const mnemonic = await this.engine.generateMnemonic();
    const stored = await this.#persist(mnemonic, passphrase, opts?.version);
    return { ...stored, mnemonic };
  }

  /** Import a wallet from an existing 24-word phrase. */
  async importMnemonic(
    input: string | string[],
    passphrase: SecretString,
    opts?: { version?: WalletVersion },
  ): Promise<{ account: AccountRef; id: string }> {
    const mnemonic = normalizeMnemonic(input);
    if (!(await this.engine.validateMnemonic(mnemonic))) {
      throw new AppError('InvalidMnemonic', 'That is not a valid 24-word TON recovery phrase.');
    }
    return this.#persist(mnemonic, passphrase, opts?.version);
  }

  list(): StoredAccount[] {
    const def = this.config.defaultAccount;
    return listKeystores().map(({ keystore }) => ({
      id: keystore.id,
      account: accountFromMeta(keystore.ton),
      isDefault: keystore.id === def || keystore.address === def,
      label: keystore.label,
    }));
  }

  /** Resolve a specific wallet (by id/address), else the default, else the only one. */
  resolve(idOrAddress?: string): StoredAccount {
    const all = this.list();
    if (all.length === 0) {
      throw new AppError('KeystoreNotFound', 'No wallets yet — run `tonsole wallet create`.');
    }
    const key = idOrAddress ?? this.config.defaultAccount;
    if (!key) {
      if (all.length === 1) return all[0]!;
      throw new AppError(
        'KeystoreNotFound',
        'Multiple wallets found — pass one or set a default with `tonsole wallet use <id>`.',
      );
    }
    const found = all.find((a) => a.id === key || a.account.address === key);
    if (!found) throw new AppError('KeystoreNotFound', `No wallet matching "${key}".`);
    return found;
  }

  setDefault(idOrAddress: string): StoredAccount {
    const acct = this.resolve(idOrAddress);
    saveConfigPatch({ defaultAccount: acct.id });
    return acct;
  }

  /** Set (or clear, with an empty string) a wallet's display label. */
  rename(idOrAddress: string, label: string): StoredAccount {
    const found = findKeystore(idOrAddress);
    if (!found) throw new AppError('KeystoreNotFound', `No wallet matching "${idOrAddress}".`);
    saveKeystore({ ...found.keystore, label: label.trim() || undefined });
    return this.resolve(found.keystore.id);
  }

  /** Delete a wallet's keystore. Reassigns the default if it pointed here. */
  remove(idOrAddress: string): void {
    const acct = this.resolve(idOrAddress);
    const wasDefault =
      this.config.defaultAccount === acct.id || this.config.defaultAccount === acct.account.address;
    deleteKeystore(acct.id);
    if (wasDefault) {
      saveConfigPatch({ defaultAccount: this.list()[0]?.id });
    }
  }

  /**
   * A keystore-backed SigningContext for an account: it decrypts the mnemonic with
   * the passphrase only inside `withMnemonic`, minimizing the plaintext's lifetime.
   */
  signingContext(account: StoredAccount, passphrase: SecretString): SigningContext {
    const found = findKeystore(account.id);
    if (!found) throw new AppError('KeystoreNotFound', `Keystore ${account.id} not found.`);
    const { keystore } = found;
    return {
      async withMnemonic(fn) {
        const mnemonic = await passphrase.use((pass) => decryptKeystore(keystore, pass));
        return fn(mnemonic.split(' '));
      },
    };
  }

  async #persist(
    mnemonic: string[],
    passphrase: SecretString,
    version?: WalletVersion,
  ): Promise<{ account: AccountRef; id: string }> {
    const account = await this.engine.deriveAccount(mnemonic, {
      network: this.config.network,
      version,
    });
    const meta: KeystoreTonMeta = {
      walletVersion: account.version,
      workchain: account.workchain,
      network: account.network,
      address: account.address,
      publicKey: account.publicKey,
    };
    const keystore = await passphrase.use((pass) => encryptKeystore(mnemonic.join(' '), pass, meta));
    saveKeystore(keystore);
    return { account, id: keystore.id };
  }
}
