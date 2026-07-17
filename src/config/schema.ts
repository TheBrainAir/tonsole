import { z } from 'zod';

const apiEndpoint = z
  .object({ url: z.string().url().optional(), key: z.string().optional() })
  .optional();

/**
 * The disclaimer version the user must acknowledge on first TUI launch. Bump this
 * when the risk/legal terms materially change to re-prompt existing users.
 */
export const DISCLAIMER_VERSION = 1;

/** Persisted user config (`~/.config/tonsole/config.json`). Testnet by default. */
export const ConfigSchema = z.object({
  network: z.enum(['mainnet', 'testnet']).default('testnet'),
  engine: z.enum(['auto', 'walletkit', 'toncore']).default('auto'),
  /**
   * The default wallet per network. Wallets are network-scoped (a testnet wallet is
   * never usable on mainnet), so a single slot would be pointing at the wrong network
   * half the time — switching networks would silently orphan the default.
   */
  defaultAccounts: z.object({ mainnet: z.string().optional(), testnet: z.string().optional() }).default({}),
  /** Pre-0.1 single default, read once as a fallback and migrated on the next write. */
  defaultAccount: z.string().optional(),
  api: z.object({ toncenter: apiEndpoint, tonapi: apiEndpoint }).default({}),
  /** The disclaimer version the user accepted; unset until they accept it once. */
  disclaimerAcceptedVersion: z.number().int().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export type EngineChoice = Config['engine'];
