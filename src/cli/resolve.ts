import type { App } from '../composition.js';
import { isValidAddress, parseAddress, toFriendly, toRaw } from '../domain/address.js';
import type { AccountRef, NetworkId } from '../engine/types.js';

/**
 * Resolve a command's `[account]` argument: a stored wallet (by id/address), the
 * default wallet when omitted, or — for read-only views — any valid address.
 */
export function resolveAccountArg(app: App, account: string | undefined): AccountRef {
  try {
    return app.accounts.resolve(account).account;
  } catch (error) {
    if (account && isValidAddress(account)) {
      return accountRefFromAddress(account, app.config.network);
    }
    throw error;
  }
}

function accountRefFromAddress(input: string, network: NetworkId): AccountRef {
  const address = parseAddress(input);
  return {
    address: toFriendly(address, { network, bounceable: false }),
    rawAddress: toRaw(address),
    workchain: address.workChain,
    version: 'v5r1',
    publicKey: '',
    network,
  };
}
