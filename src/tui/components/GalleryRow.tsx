import { Box, Text } from 'ink';

/** Thumbnail size (cells) used for the in-list block previews. */
export const THUMB_W = 8;
export const THUMB_H = 3;

/** One list row: a small block thumbnail beside a title/subtitle. */
export function GalleryRow({
  thumb,
  selected,
  title,
  subtitle,
}: {
  thumb: string | null;
  selected: boolean;
  title: string;
  subtitle?: string;
}) {
  return (
    <Box>
      <Box width={THUMB_W} height={THUMB_H} flexShrink={0}>
        {thumb ? <Text>{thumb}</Text> : null}
      </Box>
      <Box marginLeft={1} flexDirection="column">
        <Text color={selected ? 'cyan' : undefined} bold={selected}>
          {`${selected ? '❯ ' : '  '}${title}`}
        </Text>
        {subtitle ? <Text dimColor>{`  ${subtitle}`}</Text> : null}
      </Box>
    </Box>
  );
}
