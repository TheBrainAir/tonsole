/**
 * Best-effort container for an in-memory secret (passphrase / mnemonic string).
 *
 * Node.js cannot guarantee secrets are scrubbed from memory — strings are immutable
 * and GC timing is non-deterministic — so this only *minimizes* exposure: it keeps
 * the value in a Buffer we can zero, and hands a transient copy to a callback for the
 * shortest possible time. Treat the protection as defense-in-depth, not a guarantee.
 */
export class SecretString {
  #buf: Buffer | null;

  constructor(value: string) {
    this.#buf = Buffer.from(value, 'utf8');
  }

  /** Expose the secret to `fn`; the returned/awaited value is passed back through. */
  use<T>(fn: (value: string) => T): T {
    if (this.#buf === null) throw new Error('SecretString has already been destroyed');
    return fn(this.#buf.toString('utf8'));
  }

  get destroyed(): boolean {
    return this.#buf === null;
  }

  /** Zero the backing buffer and release it. Idempotent. */
  destroy(): void {
    if (this.#buf !== null) {
      this.#buf.fill(0);
      this.#buf = null;
    }
  }
}
