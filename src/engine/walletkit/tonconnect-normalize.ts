import { Address } from '@ton/core';

/**
 * WalletKit's TON Connect transaction validation hard-requires *friendly*
 * message addresses (EQ/UQ/…) and rejects raw `0:<hex>` addresses, even though
 * the TON Connect spec permits them — so dApps like minter.ton.org get rejected
 * before our approval prompt ever shows.
 *
 * The kit validates events it reads back from its storage adapter, so we
 * normalize raw → friendly there: walk the serialized record, find embedded
 * `sendTransaction` param strings, and rewrite each message's raw address to its
 * friendly form. Bounceable is false when a stateInit is attached (a deploy),
 * true otherwise; the testnet flag follows the wallet's network. The top-level
 * `from` is left untouched — WalletKit compares it with Address.equals, which is
 * form-agnostic.
 */
const RAW_ADDRESS = /^-?\d+:[0-9a-fA-F]{64}$/;

interface TxMessage {
  address?: unknown;
  stateInit?: unknown;
}

function rewriteParamString(value: string, testnet: boolean): string {
  if (!value.includes('"messages"')) return value;
  let parsed: { messages?: unknown };
  try {
    parsed = JSON.parse(value) as { messages?: unknown };
  } catch {
    return value;
  }
  if (!parsed || !Array.isArray(parsed.messages)) return value;

  let changed = false;
  for (const message of parsed.messages as TxMessage[]) {
    if (message && typeof message.address === 'string' && RAW_ADDRESS.test(message.address)) {
      try {
        message.address = Address.parse(message.address).toString({
          urlSafe: true,
          bounceable: message.stateInit == null,
          testOnly: testnet,
        });
        changed = true;
      } catch {
        // leave this address as-is; validation will surface it
      }
    }
  }
  return changed ? JSON.stringify(parsed) : value;
}

/**
 * Rewrite raw addresses to friendly inside a serialized storage record. Returns
 * the input unchanged if it isn't JSON or contains no transaction messages.
 */
export function normalizeStoredEvent(serialized: string, testnet: boolean): string {
  let root: unknown;
  try {
    root = JSON.parse(serialized);
  } catch {
    return serialized;
  }

  let changed = false;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const v = node[i];
        if (typeof v === 'string') {
          const nv = rewriteParamString(v, testnet);
          if (nv !== v) {
            node[i] = nv;
            changed = true;
          }
        } else {
          visit(v);
        }
      }
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        const v = obj[key];
        if (typeof v === 'string') {
          const nv = rewriteParamString(v, testnet);
          if (nv !== v) {
            obj[key] = nv;
            changed = true;
          }
        } else {
          visit(v);
        }
      }
    }
  };
  visit(root);
  return changed ? JSON.stringify(root) : serialized;
}
