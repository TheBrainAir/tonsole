/**
 * tonsole entrypoint (bin). With a subcommand it runs the scriptable CLI; with no
 * arguments it shows help for now (the interactive TUI takes over no-args in M4).
 */
import { buildProgram } from './cli/program.js';
import { fail } from './cli/render.js';

const parts = process.versions.node.split('.').map((n) => Number.parseInt(n, 10));
const major = parts[0] ?? 0;
const minor = parts[1] ?? 0;
if (major < 22 || (major === 22 && minor < 12)) {
  process.stderr.write(`tonsole requires Node.js >= 22.12 (found ${process.versions.node}).\n`);
  process.exit(1);
}

/** Flush stdout, then exit. WalletKit keeps handles (bridge/timers) open, so a
 *  one-shot CLI must exit explicitly rather than wait for a naturally empty loop. */
function flushStdout(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.stdout.writableNeedDrain) {
      resolve();
      return;
    }
    process.stdout.once('drain', () => resolve());
  });
}

const program = buildProgram();

if (process.argv.length <= 2) {
  // No subcommand: launch the interactive TUI on a real terminal, else show help.
  if (process.stdin.isTTY) {
    try {
      const { runTui } = await import('./tui/run.js');
      await runTui();
      process.exit(0);
    } catch (error) {
      fail(error);
    }
  } else {
    program.outputHelp();
    process.exit(0);
  }
}

try {
  await program.parseAsync(process.argv);
  await flushStdout();
  process.exit(0);
} catch (error) {
  fail(error);
}
