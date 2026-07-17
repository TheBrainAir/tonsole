import { render } from 'ink';
import type { App } from '../composition.js';
import { buildApp } from '../composition.js';
import { envNetwork, saveConfigPatch } from '../config/config.js';
import type { NetworkId } from '../engine/types.js';
import { TonsoleApp } from './app.js';

/** Build the app and render the interactive TUI; resolves when the user exits. */
export async function runTui(): Promise<void> {
  let app = await buildApp({});
  // Apps whose engine (and TON Connect SSE bridge) is still up. A network switch adds
  // the newly-built app and tears the old one down; whatever is still live at exit is
  // swept in the finally. A Set makes dispose idempotent across those two paths.
  const live = new Set<App>([app]);
  const disposeQuietly = (a: App): Promise<void> => {
    if (!live.delete(a)) return Promise.resolve();
    // One failed teardown must not strand the others' bridges/sockets.
    return a.dispose().catch(() => {});
  };

  // Fullscreen (alternate screen buffer) only on a real TTY; piped output gets
  // the fluid inline layout. Ink restores the primary buffer on unmount and
  // registers a signal-exit hook, so even a hard exit puts the shell back.
  const fullscreen = process.stdout.isTTY === true;

  /**
   * Rebuild the whole app bundle on the new network.
   *
   * The engine and the indexer are constructed from `config.network` in `buildApp`, so
   * persisting the choice and re-rendering would leave the badge saying `mainnet` while
   * balances still came from testnet — precisely the silent cross-network read the
   * wallet guard exists to prevent. Build first (a failed init leaves the old app
   * intact), then remount with a new `key` so no stale balance survives the switch.
   */
  const switchNetwork = async (network: NetworkId): Promise<void> => {
    const previous = app;
    const next = await buildApp({ network });
    app = next;
    live.add(next);
    // TONSOLE_NETWORK wins over config.json in loadConfig(), so saving under it would
    // be a lie: the next launch would silently come back here. Switch the session only.
    if (!envNetwork()) saveConfigPatch({ network });
    instance.rerender(tree(app));
    // The key change unmounts the old tree synchronously (Ink renders synchronously),
    // so nothing references `previous` after this commit. Tear its bridge down on the
    // next tick — promptly, without racing the unmount, and without piling up sockets.
    setTimeout(() => void disposeQuietly(previous), 0);
  };

  const tree = (current: App) => (
    <TonsoleApp
      key={current.config.network}
      app={current}
      fullscreen={fullscreen}
      onSwitchNetwork={switchNetwork}
    />
  );

  const instance = render(tree(app), {
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
    for (const instanceApp of [...live]) {
      await disposeQuietly(instanceApp);
    }
  }
}
