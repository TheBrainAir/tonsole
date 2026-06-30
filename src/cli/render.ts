import chalk from 'chalk';
import { exitCodeFor } from '../engine/errors.js';

export function info(message = ''): void {
  process.stdout.write(`${message}\n`);
}

export function success(message: string): void {
  process.stdout.write(`${chalk.green('✓')} ${message}\n`);
}

export function warn(message: string): void {
  process.stderr.write(`${chalk.yellow('!')} ${message}\n`);
}

/** JSON output for `--json`, with bigint rendered as a decimal string. */
export function printJson(data: unknown): void {
  const json = JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
  process.stdout.write(`${json}\n`);
}

/** Print an error and exit with the code mapped from its AppError class. */
export function fail(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${chalk.red('✗')} ${message}\n`);
  process.exit(exitCodeFor(error));
}

/** Lay out a recovery phrase as a numbered, column-major grid. */
export function renderMnemonic(words: string[]): string {
  const cols = 3;
  const rows = Math.ceil(words.length / cols);
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < cols; c++) {
      const i = c * rows + r;
      if (i < words.length) {
        const num = chalk.dim(`${String(i + 1).padStart(2, ' ')}.`);
        cells.push(`${num} ${chalk.bold((words[i] ?? '').padEnd(12))}`);
      }
    }
    lines.push(`   ${cells.join('  ')}`);
  }
  return lines.join('\n');
}
