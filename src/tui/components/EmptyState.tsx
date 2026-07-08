import { Box, Text } from 'ink';

/** Friendly empty-state line with an optional what-to-do-next hint. */
export function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <Box flexDirection="column">
      <Text dimColor>{text}</Text>
      {hint ? <Text dimColor>{hint}</Text> : null}
    </Box>
  );
}
