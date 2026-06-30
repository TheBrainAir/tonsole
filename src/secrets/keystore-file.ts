import { chmodSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { keystoreDir } from '../config/paths.js';
import type { Keystore } from './ArgonKeystore.js';

export interface StoredKeystore {
  keystore: Keystore;
  path: string;
}

function ensureKeystoreDir(): string {
  const dir = keystoreDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** List all stored keystores (skips unreadable/invalid files). Warns on loose perms. */
export function listKeystores(): StoredKeystore[] {
  const dir = keystoreDir();
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  const out: StoredKeystore[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const path = join(dir, file);
    try {
      warnIfLoosePermissions(path);
      const keystore = JSON.parse(readFileSync(path, 'utf8')) as Keystore;
      if (keystore.version === 3 && keystore.crypto) out.push({ keystore, path });
    } catch {
      // ignore malformed keystore files
    }
  }
  return out;
}

/** Find a keystore by its id or by its (user-friendly) address. */
export function findKeystore(idOrAddress: string): StoredKeystore | undefined {
  return listKeystores().find(
    ({ keystore }) => keystore.id === idOrAddress || keystore.address === idOrAddress,
  );
}

/** Persist a keystore as `<id>.json` with 0600 perms in a 0700 directory. */
export function saveKeystore(keystore: Keystore): string {
  const dir = ensureKeystoreDir();
  const path = join(dir, `${keystore.id}.json`);
  writeFileSync(path, `${JSON.stringify(keystore, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600); // enforce regardless of umask
  return path;
}

export function deleteKeystore(idOrAddress: string): boolean {
  const found = findKeystore(idOrAddress);
  if (!found) return false;
  unlinkSync(found.path);
  return true;
}

function warnIfLoosePermissions(path: string): void {
  if (process.platform === 'win32') return;
  const mode = statSync(path).mode & 0o777;
  if ((mode & 0o077) !== 0) {
    process.stderr.write(
      `tonsole: warning — keystore ${path} is group/world-accessible (mode ${mode.toString(8)}); expected 600.\n`,
    );
  }
}
