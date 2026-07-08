import { render } from 'ink';
import { buildApp } from '../composition.js';
import { TonsoleApp } from './app.js';

/** Build the app and render the interactive TUI; resolves when the user exits. */
export async function runTui(): Promise<void> {
  const app = await buildApp({});
  // Fullscreen (alternate screen buffer) only on a real TTY; piped output gets
  // the fluid inline layout. Ink restores the primary buffer on unmount and
  // registers a signal-exit hook, so even a hard exit puts the shell back.
  const fullscreen = process.stdout.isTTY === true;
  const instance = render(<TonsoleApp app={app} fullscreen={fullscreen} />, {
    alternateScreen: fullscreen,
    // NOT incrementalRendering: its line diff assumes one physical row per
    // logical line, and the transient overflow frame during a terminal resize
    // wraps — the diff then anchors wrong and leaves interleaved artifacts
    // (verified against Ink 7.1 in a PTY harness). The classic full-frame
    // writer repaints cleanly, and a terminal-sized frame is only a few KB.
    maxFps: 30,
  });

  // A stray unhandled rejection / uncaught exception would otherwise kill Node
  // while Ink still holds the terminal in raw mode + the alternate screen,
  // leaving the shell broken (needing `reset`). The ORDER is load-bearing:
  // unmount first (leaves the alternate screen, restores the TTY), then write
  // the error — anything written before the buffer switch would be lost with
  // the alternate screen.
  const onFatal = (error: unknown): void => {
    try {
      instance.unmount();
    } catch {
      // ignore — we're already exiting
    }
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`\ntonsole: fatal error — ${message}\n`);
    process.exit(1);
  };
  process.on('uncaughtException', onFatal);
  process.on('unhandledRejection', onFatal);

  try {
    await instance.waitUntilExit();
  } finally {
    process.off('uncaughtException', onFatal);
    process.off('unhandledRejection', onFatal);
    await app.dispose();
  }
}
