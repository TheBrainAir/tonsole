import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import type { NetworkId } from '../../engine/types.js';
import { color } from '../theme.js';
import { Header, type HeaderProps, type ShellStage } from './Header.js';
import { FlashProvider, StatusBar } from './StatusBar.js';
import { MIN_COLUMNS, MIN_ROWS, useViewport } from './viewport.js';

export interface AppShellProps {
  stage: ShellStage;
  network: NetworkId;
  account?: HeaderProps['account'];
  connection?: HeaderProps['connection'];
  /** Transient banner slot under the header (e.g. a dApp error). */
  banner?: ReactNode;
  children: ReactNode;
}

/**
 * The persistent frame: header on top, status bar at the bottom, the screen in
 * between. In fullscreen the frame is pinned to the terminal size and the
 * content region clips (backstop — screens size themselves via `contentRows`);
 * in fluid mode (tests, piped output) it flows naturally.
 */
export function AppShell({ stage, network, account, connection, banner, children }: AppShellProps) {
  const viewport = useViewport();

  if (viewport.tooSmall) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color={color.brand}>
          tonsole
        </Text>
        <Text>
          Terminal too small — please enlarge to at least {MIN_COLUMNS}×{MIN_ROWS} (current:{' '}
          {viewport.columns}×{viewport.rows}).
        </Text>
      </Box>
    );
  }

  // width must be "100%", not viewport.columns: yoga re-resolves a percentage
  // against the REAL terminal width on every paint, while the viewport state
  // lags one commit behind on resize — an absolute width would emit
  // wider-than-terminal lines for one frame, and the wrapped rows then corrupt
  // Ink's incremental line diff.
  const fixed = viewport.isFullscreen ? { width: '100%', height: viewport.rows } : undefined;

  return (
    <FlashProvider>
      <Box flexDirection="column" paddingX={1} {...fixed}>
        {/* Chrome rows are shrink-pinned: when a screen overflows its budget the
            CONTENT clips — the header/status bar must never be yoga-squeezed.
            (column direction so the row inside stretches to full width) */}
        <Box flexShrink={0} flexDirection="column">
          <Header stage={stage} network={network} account={account} connection={connection} />
        </Box>
        {banner ? (
          <Box flexShrink={0} flexDirection="column">
            {banner}
          </Box>
        ) : null}
        <Box
          flexDirection="column"
          marginTop={1}
          flexGrow={viewport.isFullscreen ? 1 : undefined}
          overflowY={viewport.isFullscreen ? 'hidden' : undefined}
        >
          {/* flexShrink=0: a screen taller than the viewport must CLIP at the
              bottom, not get yoga-squeezed — squeezing collapses row heights and
              the overlapping text corrupts the frame. minHeight=100% keeps the
              flexGrow chain alive for screens that center themselves. */}
          <Box
            flexDirection="column"
            flexShrink={0}
            minHeight={viewport.isFullscreen ? '100%' : undefined}
          >
            {children}
          </Box>
        </Box>
        <Box flexShrink={0} flexDirection="column">
          <StatusBar />
        </Box>
      </Box>
    </FlashProvider>
  );
}
