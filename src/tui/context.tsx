import { createContext, useContext } from 'react';
import type { App } from '../composition.js';

const AppContext = createContext<App | null>(null);

export const AppProvider = AppContext.Provider;

export function useApp(): App {
  const app = useContext(AppContext);
  if (!app) throw new Error('AppProvider is missing from the tree');
  return app;
}
