import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { keystoreDir } from '../config/paths.js';
import type { Keystore } from './ArgonKeystore.js';
import { parseKeystore } from './keystore-schema.js';

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
      // Validate + bound Argon2 params on load (rejects tampered / DoS-crafted files).
      const keystore = parseKeystore(JSON.parse(readFileSync(path, 'utf8')));
      out.push({ keystore, path });
    } catch {
      // ignore malformed / invalid keystore files
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

/**
 * Persist a keystore as `<id>.json` with 0600 perms in a 0700 directory.
 *
 * Written atomically: a fresh `<id>.json.tmp` is fully written, then `rename`d over
 * the target (rename is atomic on POSIX). This prevents a crash / power loss / full
 * disk mid-write from truncating the ONLY copy of the encrypted key material. If a
 * previous keystore exists it is first copied to `<id>.json.bak` as a safety net.
 */
export function saveKeystore(keystore: Keystore): string {
  const dir = ensureKeystoreDir();
  const path = join(dir, `${keystore.id}.json`);
  const tmp = `${path}.tmp`;
  const backup = `${path}.bak`;

  if (existsSync(path)) {
    copyFileSync(path, backup);
    chmodSync(backup, 0o600);
  }
  writeFileSync(tmp, `${JSON.stringify(keystore, null, 2)}\n`, { mode: 0o600 });
  chmodSync(tmp, 0o600); // enforce regardless of umask
  renameSync(tmp, path);
  return path;
}

export function deleteKeystore(idOrAddress: string): boolean {
  const found = findKeystore(idOrAddress);
  if (!found) return false;
  unlinkSync(found.path);
  // Also remove the atomic-write temp and the backup copy, so removing a wallet
  // doesn't leave an orphaned `<id>.json.bak` holding the same (encrypted) material.
  for (const sibling of [`${found.path}.bak`, `${found.path}.tmp`]) {
    if (existsSync(sibling)) {
      try {
        unlinkSync(sibling);
      } catch {
        // best-effort cleanup
      }
    }
  }
  return true;
}

function warnIfLoosePermissions(path: string): void {
  if (process.platform === 'win32') return;
  const st = statSync(path);
  const mode = st.mode & 0o777;
  if ((mode & 0o077) !== 0) {
    process.stderr.write(
      `tonsole: SECURITY WARNING — keystore ${path} is group/world-accessible (mode ${mode.toString(8)}); ` +
        `expected 600. Run: chmod 600 "${path}"\n`,
    );
  }
  // Flag a keystore owned by another user — a sign of tampering on a shared host.
  const geteuid = process.geteuid?.bind(process);
  if (geteuid && st.uid !== geteuid()) {
    process.stderr.write(
      `tonsole: SECURITY WARNING — keystore ${path} is owned by uid ${st.uid}, not you. Do not trust it.\n`,
    );
  }
}
