import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

export interface SelectItem<T> {
  label: string;
  value: T;
  hint?: string;
}

export interface SelectListProps<T> {
  items: ReadonlyArray<SelectItem<T>>;
  onSelect: (value: T) => void;
  focus?: boolean;
}

/** Arrow-key (or j/k) selectable list; Enter chooses the highlighted item. */
export function SelectList<T>({ items, onSelect, focus = true }: SelectListProps<T>) {
  const [index, setIndex] = useState(0);

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') {
        setIndex((i) => (i - 1 + items.length) % items.length);
      } else if (key.downArrow || input === 'j') {
        setIndex((i) => (i + 1) % items.length);
      } else if (key.return) {
        const item = items[index];
        if (item) onSelect(item.value);
      }
    },
    { isActive: focus },
  );

  return (
    <Box flexDirection="column">
      {items.map((item, i) => (
        <Text key={i} color={i === index ? 'cyan' : undefined}>
          {i === index ? '❯ ' : '  '}
          {item.label}
          {item.hint ? <Text dimColor>{`  ${item.hint}`}</Text> : null}
        </Text>
      ))}
    </Box>
  );
}
