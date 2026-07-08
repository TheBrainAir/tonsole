import { Box, Text, useInput } from 'ink';
import { useState, type ReactNode } from 'react';
import { useInputGate } from '../shell/keymap.js';
import { useViewport } from '../shell/viewport.js';
import { color, symbol } from '../theme.js';

export interface ListViewProps<T> {
  items: readonly T[];
  renderItem: (item: T, ctx: { selected: boolean; index: number }) => ReactNode;
  /** Rows per item (3 for gallery rows with thumbnails). */
  itemHeight?: number;
  /** Controlled selection — pass together with onSelectionChange (detail panes). */
  selected?: number;
  onSelectionChange?: (index: number) => void;
  /** Enter on the highlighted item. */
  onActivate?: (item: T, index: number) => void;
  /** Rows the screen keeps for itself below/above the list. */
  reservedRows?: number;
  /** Hard cap on visible items. */
  maxVisible?: number;
  isActive?: boolean;
  /** Wrap-around selection (menus); data lists clamp. */
  wrap?: boolean;
  /** Fires when the selection moves past the last loaded item (pagination). */
  onEndReached?: () => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * The one selectable, windowed list: ↑↓/jk move, PgUp/PgDn page, g/G or
 * Home/End jump, ⏎ activates. The window is sized from the viewport, keeps the
 * selection centered, and shows `↑/↓ N more` plus a proportional scrollbar
 * when it overflows.
 */
export function ListView<T>({
  items,
  renderItem,
  itemHeight = 1,
  selected: selectedProp,
  onSelectionChange,
  onActivate,
  reservedRows = 0,
  maxVisible,
  isActive = true,
  wrap = false,
  onEndReached,
}: ListViewProps<T>) {
  const viewport = useViewport();
  const [selectedState, setSelectedState] = useState(0);
  const selected = clamp(selectedProp ?? selectedState, 0, Math.max(0, items.length - 1));
  const setSelected = (index: number) => {
    setSelectedState(index);
    onSelectionChange?.(index);
  };

  const availableRows = Math.max(itemHeight, viewport.contentRows - reservedRows);
  const naive = Math.floor(availableRows / itemHeight);
  const overflowing = items.length > naive;
  // The ↑/↓ N more indicator lines take two rows once the list overflows.
  const rowsForItems = overflowing ? Math.max(itemHeight, availableRows - 2) : availableRows;
  const visibleCount = clamp(
    Math.floor(rowsForItems / itemHeight),
    1,
    Math.min(items.length, maxVisible ?? Number.POSITIVE_INFINITY),
  );

  const start = clamp(
    selected - Math.floor(visibleCount / 2),
    0,
    Math.max(0, items.length - visibleCount),
  );
  const visible = items.slice(start, start + visibleCount);
  const below = items.length - start - visibleCount;

  const active = useInputGate(isActive && items.length > 0);
  useInput(
    (input, key) => {
      const last = items.length - 1;
      if (key.upArrow || input === 'k') {
        if (wrap) setSelected(selected === 0 ? last : selected - 1);
        else setSelected(Math.max(0, selected - 1));
      } else if (key.downArrow || input === 'j') {
        if (wrap) setSelected(selected === last ? 0 : selected + 1);
        else {
          if (selected === last) onEndReached?.();
          setSelected(Math.min(last, selected + 1));
        }
      } else if (key.pageUp) {
        setSelected(Math.max(0, selected - visibleCount));
      } else if (key.pageDown) {
        if (selected + visibleCount > last) onEndReached?.();
        setSelected(Math.min(last, selected + visibleCount));
      } else if (key.home || input === 'g') {
        setSelected(0);
      } else if (key.end || input === 'G') {
        setSelected(last);
        onEndReached?.();
      } else if (key.return) {
        const item = items[selected];
        if (item !== undefined) onActivate?.(item, selected);
      }
    },
    { isActive: active },
  );

  // Proportional scrollbar beside the rows (only when the list overflows).
  const trackHeight = visibleCount * itemHeight;
  const showScrollbar = overflowing && trackHeight >= 2;
  let track: ReactNode = null;
  if (showScrollbar) {
    const thumbSize = Math.max(1, Math.round((visibleCount / items.length) * trackHeight));
    const maxOffset = trackHeight - thumbSize;
    const denom = Math.max(1, items.length - visibleCount);
    const offset = Math.round((start / denom) * maxOffset);
    track = (
      <Box flexDirection="column" flexShrink={0} marginLeft={1}>
        {Array.from({ length: trackHeight }, (_, i) => (
          <Text key={i} dimColor>
            {i >= offset && i < offset + thumbSize ? symbol.scrollThumb : symbol.scrollTrack}
          </Text>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {start > 0 ? <Text dimColor>{`  ↑ ${start} more`}</Text> : null}
      <Box>
        <Box flexDirection="column" flexGrow={1}>
          {visible.map((item, i) => (
            <Box key={start + i} flexDirection="column">
              {renderItem(item, { selected: start + i === selected, index: start + i })}
            </Box>
          ))}
        </Box>
        {track}
      </Box>
      {below > 0 ? <Text dimColor>{`  ↓ ${below} more`}</Text> : null}
    </Box>
  );
}

/** Simple labeled menu row for ListView-based menus. */
export function MenuRow({
  label,
  hint,
  selected,
}: {
  label: string;
  hint?: string;
  selected: boolean;
}) {
  return (
    <Text color={selected ? color.brand : undefined} wrap="truncate">
      {selected ? `${symbol.pointer} ` : '  '}
      {label}
      {hint ? <Text dimColor>{`  ${hint}`}</Text> : null}
    </Text>
  );
}
