import { Text, useAnimation } from 'ink';
import { color, symbol } from '../theme.js';

/**
 * Animated loading indicator. All Ink animations share one internal timer, so
 * any number of spinners cost a single render cycle.
 */
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  const { frame } = useAnimation({ interval: 80 });
  return (
    <Text>
      <Text color={color.brand}>{symbol.spinnerFrames[frame % symbol.spinnerFrames.length]}</Text>
      <Text dimColor> {label}</Text>
    </Text>
  );
}
