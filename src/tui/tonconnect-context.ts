import { createContext, useContext } from 'react';
import type { AccountRef, TonConnectSessionInfo } from '../engine/types.js';

/**
 * App-level TON Connect controller. Lives above the screen router so the session
 * persists when the user leaves the Connect screen, and incoming dApp requests
 * surface as a global prompt on whatever screen is showing.
 */
export interface TonConnectController {
  unlocked: boolean;
  status: string;
  /** Currently connected dApp sessions (kept fresh by the app root). */
  sessions?: TonConnectSessionInfo[];
  unlock(account: AccountRef, passphrase: string): Promise<void>;
  submitUrl(url: string): Promise<void>;
  refreshSessions?(): Promise<void>;
  disconnect?(sessionId?: string): Promise<void>;
}

const TonConnectContext = createContext<TonConnectController | null>(null);
export const TonConnectProvider = TonConnectContext.Provider;

export function useTonConnect(): TonConnectController {
  const controller = useContext(TonConnectContext);
  if (!controller) throw new Error('TonConnectProvider is missing from the tree');
  return controller;
}
