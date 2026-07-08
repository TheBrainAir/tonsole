import { Box, Text } from 'ink';
import { useEffect, type ReactNode } from 'react';
import { OverlayScopeProvider, useKeymap, type KeyBinding } from '../shell/keymap.js';
import { useViewport } from '../shell/viewport.js';
import { color } from '../theme.js';
import { Panel, type PanelTone } from './Panel.js';

/**
 * Centered modal panel. Ink has no z-order, so the convention is: the screen
 * keeps its current content mounted inside `<Box display="none">` (state
 * survives) and renders this instead. Registering an overlay keymap scope —
 * even an empty one — masks every screen/app binding underneath, and
 * `useInputGate` silences the hidden screen's own inputs.
 */
export function CenteredModal({
  title,
  tone = 'focus',
  width,
  bindings = [],
  layer = 'overlay',
  onMasked,
  footer,
  children,
}: {
  title?: ReactNode;
  tone?: PanelTone;
  width?: number;
  /** Overlay-layer keys owned by this modal (y/n/esc…). */
  bindings?: KeyBinding[];
  /** `system` for the app-level dApp prompts — outranks every screen modal. */
  layer?: 'overlay' | 'system';
  /** Called when a higher overlay (e.g. a dApp prompt) shadows this modal. */
  onMasked?: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const viewport = useViewport();
  const { scopeId, masked } = useKeymap(layer, bindings);
  useEffect(() => {
    if (masked) onMasked?.();
  }, [masked, onMasked]);

  const panelWidth = Math.min(width ?? 64, viewport.contentWidth);
  return (
    <OverlayScopeProvider value={scopeId}>
      <Box
        flexDirection="column"
        flexGrow={viewport.isFullscreen ? 1 : undefined}
        justifyContent="center"
        alignItems="center"
      >
        <Panel title={title} tone={tone} width={panelWidth}>
          {children}
        </Panel>
        {footer ? <Box>{footer}</Box> : null}
      </Box>
    </OverlayScopeProvider>
  );
}

/** The `y verb · n/esc cancel` line under confirm modals (display only —
 *  the actual keys are the modal's overlay bindings). */
export function ConfirmBar({ verb, cancelLabel = 'cancel' }: { verb: string; cancelLabel?: string }) {
  return (
    <Text>
      <Text color={color.accent}>y</Text>
      <Text> {verb}</Text>
      <Text dimColor> · </Text>
      <Text color={color.accent}>n/esc</Text>
      <Text dimColor> {cancelLabel}</Text>
    </Text>
  );
}
