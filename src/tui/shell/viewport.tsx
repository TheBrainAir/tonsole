import { useWindowSize } from 'ink';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { breakpoints } from '../theme.js';

export type Breakpoint = 'narrow' | 'medium' | 'wide';

/**
 * Terminal geometry, distributed via context so there is exactly one resize
 * subscription and one place that knows about the test-environment fallback.
 * Components must consume `useViewport()` — never `useWindowSize()` directly.
 */
export interface Viewport {
  columns: number;
  rows: number;
  breakpoint: Breakpoint;
  /** False in tests and non-TTY runs — sizes are then fixed fallbacks. */
  isFullscreen: boolean;
  /** Columns available inside the shell's horizontal padding. */
  contentWidth: number;
  /** Rows available to the current screen between header and status bar. */
  contentRows: number;
  /** Fullscreen terminal is below the minimum usable size. */
  tooSmall: boolean;
}

export const MIN_COLUMNS = 60;
export const MIN_ROWS = 16;
/** Header (1) + gap (1) + gap above status bar (1) + status bar (1) + safety (1). */
export const CHROME_ROWS = 5;

const FALLBACK_COLUMNS = 100;
const FALLBACK_ROWS = 24;

function toBreakpoint(columns: number): Breakpoint {
  if (columns < breakpoints.narrow) return 'narrow';
  if (columns < breakpoints.wide) return 'medium';
  return 'wide';
}

function buildViewport(columns: number, rows: number, isFullscreen: boolean): Viewport {
  return {
    columns,
    rows,
    breakpoint: toBreakpoint(columns),
    isFullscreen,
    contentWidth: Math.max(20, columns - 2),
    contentRows: Math.max(6, rows - CHROME_ROWS),
    tooSmall: isFullscreen && (columns < MIN_COLUMNS || rows < MIN_ROWS),
  };
}

// Default (no provider): the fluid fallback, so components render deterministically
// in unit tests that mount a single screen without the full app shell.
const ViewportContext = createContext<Viewport>(buildViewport(FALLBACK_COLUMNS, FALLBACK_ROWS, false));

export function ViewportProvider({
  fullscreen,
  children,
}: {
  fullscreen: boolean;
  children: ReactNode;
}) {
  const size = useWindowSize();
  const viewport = useMemo(() => {
    if (!fullscreen) {
      // Fluid mode (tests / piped stdout): ink-testing-library's stdout stub reports
      // columns but not rows, and Ink then falls back to the *host* terminal for
      // rows — non-deterministic. Pin the rows; keep the reported columns.
      return buildViewport(size.columns || FALLBACK_COLUMNS, FALLBACK_ROWS, false);
    }
    return buildViewport(size.columns || FALLBACK_COLUMNS, size.rows || FALLBACK_ROWS, true);
  }, [fullscreen, size.columns, size.rows]);

  return <ViewportContext.Provider value={viewport}>{children}</ViewportContext.Provider>;
}

export function useViewport(): Viewport {
  return useContext(ViewportContext);
}
