import { Box, Text } from 'ink';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { color, symbol } from '../theme.js';
import { useKeyHintItems } from './keymap.js';

export type FlashTone = 'success' | 'danger' | 'muted';

interface Flash {
  text: string;
  tone: FlashTone;
}

type SetFlash = (text: string | null, tone?: FlashTone) => void;

const FlashValueContext = createContext<Flash | null>(null);
const FlashSetterContext = createContext<SetFlash>(() => {});

const FLASH_MS = 2500;

/**
 * Transient status messages ("✓ address copied") shown on the right of the
 * status bar — replaces the per-screen `status` state lines. Auto-clears.
 */
export function FlashProvider({ children }: { children: ReactNode }) {
  const [flash, setFlashState] = useState<Flash | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setFlash = useCallback<SetFlash>((text, tone = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    if (text === null) {
      setFlashState(null);
      return;
    }
    setFlashState({ text, tone });
    timer.current = setTimeout(() => setFlashState(null), FLASH_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <FlashSetterContext.Provider value={setFlash}>
      <FlashValueContext.Provider value={flash}>{children}</FlashValueContext.Provider>
    </FlashSetterContext.Provider>
  );
}

/** `flash('✓ copied')` / `flash('✗ failed', 'danger')` from any screen. */
export function useFlash(): SetFlash {
  return useContext(FlashSetterContext);
}

const toneColor: Record<FlashTone, string | undefined> = {
  success: color.success,
  danger: color.danger,
  muted: undefined,
};

/** Bottom chrome row: contextual key hints (left) + flash message (right). */
export function StatusBar() {
  const hints = useKeyHintItems();
  const flash = useContext(FlashValueContext);

  const hintText = useMemo(
    () =>
      hints.map((h, i) => (
        <Text key={i}>
          {i > 0 ? <Text dimColor>{symbol.sep}</Text> : null}
          <Text color={color.accent}>{h.keys}</Text>
          <Text dimColor> {h.label}</Text>
        </Text>
      )),
    [hints],
  );

  return (
    <Box justifyContent="space-between" marginTop={1}>
      <Text wrap="truncate">{hintText}</Text>
      {flash ? (
        <Box marginLeft={2} flexShrink={0}>
          <Text color={toneColor[flash.tone]} dimColor={flash.tone === 'muted'}>
            {flash.text}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
