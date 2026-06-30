/**
 * Single normalized error taxonomy for the whole app. Engines, network clients,
 * and services translate their failures into an `AppError` with a stable `code`,
 * so the TUI/CLI can render actionable messages and map to process exit codes
 * without knowing which engine or provider produced the failure.
 */
export type AppErrorCode =
  | 'NetworkUnavailable'
  | 'RateLimited'
  | 'InsufficientBalance'
  | 'EmulationFailed'
  | 'InvalidAddress'
  | 'InvalidAmount'
  | 'InvalidMnemonic'
  | 'KeystoreNotFound'
  | 'KeystoreLocked'
  | 'WrongPassphrase'
  | 'EngineUnsupported'
  | 'BridgeError'
  | 'Cancelled'
  | 'Unknown';

export interface AppErrorOptions {
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: AppErrorCode, message: string, opts?: AppErrorOptions) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.details = opts?.details;
  }

  static is(e: unknown, code?: AppErrorCode): e is AppError {
    return e instanceof AppError && (code === undefined || e.code === code);
  }
}

/** Stable process exit codes per error class, for scriptable CLI usage. */
export const EXIT_CODES: Record<AppErrorCode, number> = {
  Unknown: 1,
  InvalidAddress: 2,
  InvalidAmount: 2,
  InvalidMnemonic: 2,
  InsufficientBalance: 3,
  EmulationFailed: 4,
  WrongPassphrase: 5,
  KeystoreLocked: 5,
  KeystoreNotFound: 6,
  NetworkUnavailable: 7,
  RateLimited: 8,
  EngineUnsupported: 9,
  BridgeError: 10,
  Cancelled: 0,
};

export function exitCodeFor(e: unknown): number {
  return AppError.is(e) ? EXIT_CODES[e.code] : 1;
}
