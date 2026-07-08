import * as readline from 'node:readline';
import { AppError } from '../engine/errors.js';
import { SecretString } from './secret-string.js';

function readLineHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // Suppress echo of typed characters (no-echo password entry).
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
    process.stdout.write(prompt);
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

function readLinePlain(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    rl.once('line', (line) => {
      rl.close();
      resolve(line);
    });
    rl.once('close', () => resolve(''));
  });
}

/** Read one plain (echoed) line after writing a prompt — used for non-secret input. */
export function readLine(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  return readLinePlain();
}

/**
 * Read one secret line WITHOUT echoing it (for a mnemonic entered interactively).
 * On a pipe there is no terminal echo to suppress, so it reads the line plainly.
 */
export function readLineSecret(prompt: string): Promise<string> {
  if (process.stdin.isTTY === true) return readLineHidden(prompt);
  process.stdout.write(prompt);
  return readLinePlain();
}

/**
 * Prompt for a passphrase without echoing it. For non-interactive/test use it honors
 * the TONSOLE_PASSPHRASE env var (documented as insecure — for automation only).
 * The returned SecretString should be `.destroy()`ed by the caller after use.
 */
export async function promptPassphrase(
  prompt = 'Passphrase: ',
  opts?: { confirm?: boolean; minLength?: number },
): Promise<SecretString> {
  const min = opts?.minLength ?? 1;

  // Automation path. Still enforce the minimum length so an empty/1-char env value
  // can't silently create a trivially-brute-forceable keystore (the interactive
  // confirm is skipped — the value is provided programmatically).
  const fromEnv = process.env.TONSOLE_PASSPHRASE;
  if (fromEnv !== undefined) {
    if (fromEnv.length < min) {
      throw new AppError('WrongPassphrase', `TONSOLE_PASSPHRASE must be at least ${min} character(s).`);
    }
    return new SecretString(fromEnv);
  }

  const interactive = process.stdin.isTTY === true;
  const value = interactive ? await readLineHidden(prompt) : await readLinePlain();

  if (value.length < min) {
    throw new AppError('WrongPassphrase', `Passphrase must be at least ${min} character(s).`);
  }
  if (opts?.confirm && interactive) {
    const again = await readLineHidden('Confirm passphrase: ');
    if (again !== value) throw new AppError('WrongPassphrase', 'Passphrases do not match.');
  }
  return new SecretString(value);
}
