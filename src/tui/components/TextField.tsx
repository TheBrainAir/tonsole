import { Box, Text, useInput, usePaste } from 'ink';
import { useState } from 'react';
import { sanitizeText } from '../../domain/sanitize.js';
import { useInputGate } from '../shell/keymap.js';
import { color, space } from '../theme.js';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  focus?: boolean;
  mask?: boolean;
  placeholder?: string;
  /** Validation message shown in red under the field. */
  error?: string | null;
  /** Dim helper line shown under the field while focused (hidden by `error`). */
  helper?: string;
  /** Visible value width; longer values scroll horizontally around the cursor. */
  width?: number;
  labelWidth?: number;
}

/**
 * Single-line text input with a real cursor: ←/→, Home/End (ctrl+a/e),
 * backspace/delete, ctrl+u (kill line), ctrl+w (kill word), mid-string
 * insertion, and bracketed paste. Pasted text is untrusted terminal input —
 * it goes through `sanitizeText` (strips ESC/OSC/bidi, collapses newlines to
 * spaces, which is exactly what a 24-word mnemonic paste needs).
 */
export function TextField({
  label,
  value,
  onChange,
  onSubmit,
  focus = true,
  mask = false,
  placeholder,
  error,
  helper,
  width,
  labelWidth = space.fieldLabelWidth,
}: TextFieldProps) {
  const [cursorState, setCursorState] = useState(value.length);
  // The parent may rewrite/clear the value (e.g. passphrase cleared after
  // capture) — derive the effective cursor instead of chasing it with effects.
  const cursor = Math.min(cursorState, value.length);

  const edit = (next: string, nextCursor: number) => {
    onChange(next);
    setCursorState(Math.max(0, Math.min(next.length, nextCursor)));
  };
  const insert = (text: string) => {
    if (text.length === 0) return;
    edit(value.slice(0, cursor) + text + value.slice(cursor), cursor + text.length);
  };

  const active = useInputGate(focus);
  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit?.(value);
      } else if (key.leftArrow) {
        setCursorState(Math.max(0, cursor - 1));
      } else if (key.rightArrow) {
        setCursorState(Math.min(value.length, cursor + 1));
      } else if (key.home || (key.ctrl && input === 'a')) {
        setCursorState(0);
      } else if (key.end || (key.ctrl && input === 'e')) {
        setCursorState(value.length);
      } else if (key.backspace || key.delete) {
        // Terminals disagree on which of the two Backspace maps to; treat both
        // as delete-before-cursor (matches the previous behavior).
        if (cursor > 0) edit(value.slice(0, cursor - 1) + value.slice(cursor), cursor - 1);
      } else if (key.ctrl && input === 'u') {
        edit(value.slice(cursor), 0);
      } else if (key.ctrl && input === 'w') {
        const head = value.slice(0, cursor).replace(/\S+\s*$/, '');
        edit(head + value.slice(cursor), head.length);
      } else if (
        !key.ctrl &&
        !key.meta &&
        !key.tab &&
        !key.upArrow &&
        !key.downArrow &&
        !key.escape &&
        !key.pageUp &&
        !key.pageDown &&
        input
      ) {
        insert(input);
      }
    },
    { isActive: active },
  );
  usePaste((text) => insert(sanitizeText(text, { maxLen: 4096 })), { isActive: active });

  const shown = mask ? '•'.repeat(value.length) : value;

  // Horizontal window: keep the cursor visible inside `width` cells.
  let from = 0;
  if (width !== undefined && shown.length + 1 > width) {
    from = Math.max(0, Math.min(cursor - width + 1, shown.length + 1 - width));
  }
  const windowed = width !== undefined ? shown.slice(from, from + width) : shown;
  const cur = cursor - from;
  const pre = windowed.slice(0, cur);
  const at = windowed.slice(cur, cur + 1) || ' ';
  const post = windowed.slice(cur + 1);

  const labelColor = error ? color.danger : focus ? color.brand : undefined;

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={labelWidth} flexShrink={0}>
          <Text color={labelColor} bold={focus}>
            {label}
          </Text>
        </Box>
        {shown.length === 0 && !focus ? (
          <Text dimColor>{placeholder ?? ''}</Text>
        ) : focus ? (
          <Text>
            {shown.length === 0 && placeholder ? (
              <Text>
                <Text inverse>{placeholder.slice(0, 1)}</Text>
                <Text dimColor>{placeholder.slice(1)}</Text>
              </Text>
            ) : (
              <Text>
                {pre}
                <Text inverse>{at}</Text>
                {post}
              </Text>
            )}
          </Text>
        ) : (
          <Text>{windowed}</Text>
        )}
      </Box>
      {error ? (
        <Box marginLeft={labelWidth}>
          <Text color={color.danger}>✗ {error}</Text>
        </Box>
      ) : focus && helper ? (
        <Box marginLeft={labelWidth}>
          <Text dimColor>{helper}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
