import { Box, Text, useInput } from 'ink';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  focus?: boolean;
  mask?: boolean;
  placeholder?: string;
}

/** Minimal single-line controlled text input (masked for passphrases). */
export function TextField({
  label,
  value,
  onChange,
  onSubmit,
  focus = true,
  mask = false,
  placeholder,
}: TextFieldProps) {
  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit?.(value);
      } else if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
      } else if (
        !key.ctrl &&
        !key.meta &&
        !key.tab &&
        !key.upArrow &&
        !key.downArrow &&
        !key.leftArrow &&
        !key.rightArrow &&
        !key.escape &&
        input
      ) {
        onChange(value + input);
      }
    },
    { isActive: focus },
  );

  const display = mask ? '•'.repeat(value.length) : value;
  return (
    <Box>
      <Text color={focus ? 'cyan' : undefined}>{label} </Text>
      {display.length > 0 ? <Text>{display}</Text> : <Text dimColor>{placeholder ?? ''}</Text>}
      {focus ? <Text inverse> </Text> : null}
    </Box>
  );
}
