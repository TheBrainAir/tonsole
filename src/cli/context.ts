import type { Command } from 'commander';
import { AppError } from '../engine/errors.js';
import type { NetworkId } from '../engine/types.js';

export interface CliGlobals {
  network?: NetworkId;
  json: boolean;
}

/** Read the global `--network` / `--json` options (merged from parent commands). */
export function readGlobals(command: Command): CliGlobals {
  const opts = command.optsWithGlobals();
  let network: NetworkId | undefined;
  const n: unknown = opts.network;
  if (n === 'mainnet' || n === 'testnet') {
    network = n;
  } else if (typeof n === 'string') {
    throw new AppError('Unknown', `Unknown network "${n}" — use "mainnet" or "testnet".`);
  }
  return { network, json: opts.json === true };
}
