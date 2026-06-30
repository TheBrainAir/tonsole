import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Base config directory, XDG-compliant. Honors `XDG_CONFIG_HOME`, falls back to
 * `%APPDATA%\tonsole` on Windows, otherwise `~/.config/tonsole`.
 */
export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  if (xdg) return join(xdg, 'tonsole');
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA?.trim();
    if (appData) return join(appData, 'tonsole');
  }
  return join(homedir(), '.config', 'tonsole');
}

export function keystoreDir(): string {
  return join(configDir(), 'keystore');
}

export function configFile(): string {
  return join(configDir(), 'config.json');
}

export function contactsFile(): string {
  return join(configDir(), 'contacts.json');
}
