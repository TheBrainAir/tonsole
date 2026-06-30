import { render } from 'ink';
import { buildApp } from '../composition.js';
import { TonsoleApp } from './app.js';

/** Build the app and render the interactive TUI; resolves when the user exits. */
export async function runTui(): Promise<void> {
  const app = await buildApp({});
  const instance = render(<TonsoleApp app={app} />);
  try {
    await instance.waitUntilExit();
  } finally {
    await app.dispose();
  }
}
