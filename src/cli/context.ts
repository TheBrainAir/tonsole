import type { Command } from 'commander';
import { parseNetworkId } from '../config/networks.js';
import type { NetworkId } from '../engine/types.js';

export interface CliGlobals {
  network?: NetworkId;
  json: boolean;
}

/** Read the global `--network` / `--json` options (merged from parent commands). */
export function readGlobals(command: Command): CliGlobals {
  const opts = command.optsWithGlobals();
  const n: unknown = opts.network;
  const network = typeof n === 'string' ? parseNetworkId(n) : undefined;
  return { network, json: opts.json === true };
}
