import { Text } from 'ink';
import { color } from '../theme.js';

/** One `key label` pair, as rendered in the status bar and inline hints. */
export function KeyHint({ keys, label }: { keys: string; label: string }) {
  return (
    <Text>
      <Text color={color.accent}>{keys}</Text>
      <Text dimColor> {label}</Text>
    </Text>
  );
}
