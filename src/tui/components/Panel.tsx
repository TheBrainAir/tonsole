import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { border, space } from '../theme.js';

export type PanelTone = 'default' | 'focus' | 'success' | 'danger' | 'warning';

const toneBorder: Record<PanelTone, string> = {
  default: border.default,
  focus: border.focus,
  success: border.success,
  danger: border.danger,
  warning: border.warning,
};

export interface PanelProps {
  title?: ReactNode;
  tone?: PanelTone;
  width?: number | string;
  minHeight?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | string;
  marginTop?: number;
  paddingX?: number;
  children: ReactNode;
}

/** Bordered card with an optional bold title row — the one box of the app. */
export function Panel({
  title,
  tone = 'default',
  width,
  minHeight,
  flexGrow,
  flexShrink,
  flexBasis,
  marginTop,
  paddingX = space.panelPaddingX,
  children,
}: PanelProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle={border.style}
      borderColor={toneBorder[tone]}
      width={width}
      minHeight={minHeight}
      flexGrow={flexGrow}
      flexShrink={flexShrink}
      flexBasis={flexBasis}
      marginTop={marginTop}
      paddingX={paddingX}
    >
      {title !== undefined ? (
        <Text bold color={tone === 'default' ? undefined : toneBorder[tone]} wrap="truncate">
          {title}
        </Text>
      ) : null}
      {children}
    </Box>
  );
}
