import { Text } from 'ink';
import type { ReactNode } from 'react';
import type { NetworkId } from '../../engine/types.js';
import { color, symbol } from '../theme.js';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'muted' | 'brand';

const variantColor: Record<BadgeVariant, string | undefined> = {
  success: color.success,
  danger: color.danger,
  warning: color.warning,
  info: color.info,
  muted: undefined, // rendered dim instead
  brand: color.brand,
};

export function Badge({
  variant,
  bold = false,
  children,
}: {
  variant: BadgeVariant;
  bold?: boolean;
  children: ReactNode;
}) {
  return (
    <Text color={variantColor[variant]} dimColor={variant === 'muted'} bold={bold}>
      {children}
    </Text>
  );
}

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return <Badge variant="success">{compact ? symbol.check : `${symbol.check} verified`}</Badge>;
}

export function ScamBadge({ compact = false }: { compact?: boolean }) {
  return (
    <Badge variant="danger" bold>
      {compact ? symbol.warn : `${symbol.warn} SCAM`}
    </Badge>
  );
}

/** Testnet must never be mistakable for mainnet — it renders in warning color. */
export function NetworkBadge({ network }: { network: NetworkId }) {
  return <Badge variant={network === 'testnet' ? 'warning' : 'muted'}>{network}</Badge>;
}
