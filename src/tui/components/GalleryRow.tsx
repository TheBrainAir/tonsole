import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { color, space, symbol } from '../theme.js';

/** Thumbnail size (cells) used for the in-list block previews. */
export const THUMB_W = space.thumbW;
export const THUMB_H = space.thumbH;

/** One list row: a small block thumbnail beside a title/subtitle. */
export function GalleryRow({
  thumb,
  selected,
  title,
  badge,
  subtitle,
}: {
  thumb: string | null;
  selected: boolean;
  title: string;
  badge?: ReactNode;
  subtitle?: string;
}) {
  return (
    <Box height={THUMB_H}>
      <Box width={THUMB_W} height={THUMB_H} flexShrink={0} overflowY="hidden">
        {thumb ? <Text>{thumb}</Text> : null}
      </Box>
      <Box marginLeft={1} flexDirection="column">
        <Text wrap="truncate">
          <Text color={selected ? color.brand : undefined} bold={selected}>
            {`${selected ? `${symbol.pointer} ` : '  '}${title}`}
          </Text>
          {badge ? <Text> {badge}</Text> : null}
        </Text>
        {subtitle ? (
          <Text dimColor wrap="truncate">{`  ${subtitle}`}</Text>
        ) : null}
      </Box>
    </Box>
  );
}
