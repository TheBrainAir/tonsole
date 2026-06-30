import { z } from 'zod';

const apiEndpoint = z
  .object({ url: z.string().url().optional(), key: z.string().optional() })
  .optional();

/** Persisted user config (`~/.config/tonsole/config.json`). Testnet by default. */
export const ConfigSchema = z.object({
  network: z.enum(['mainnet', 'testnet']).default('testnet'),
  engine: z.enum(['auto', 'walletkit', 'toncore']).default('auto'),
  defaultAccount: z.string().optional(),
  api: z.object({ toncenter: apiEndpoint, tonapi: apiEndpoint }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type EngineChoice = Config['engine'];
