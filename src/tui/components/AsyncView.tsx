import { Text } from 'ink';
import type { ReactNode } from 'react';
import type { AsyncState } from '../hooks/useAsync.js';
import { color } from '../theme.js';
import { EmptyState } from './EmptyState.js';
import { Spinner } from './Spinner.js';

export interface AsyncViewProps<T> {
  state: AsyncState<T>;
  loadingLabel?: string;
  emptyWhen?: (data: T) => boolean;
  emptyText?: string;
  emptyHint?: string;
  children: (data: T) => ReactNode;
}

/**
 * The loading → error → empty → data ladder every data screen repeats.
 * Screens own the `r` refresh binding themselves (one per screen, reloading
 * everything), so this stays a pure render helper.
 */
export function AsyncView<T>({
  state,
  loadingLabel,
  emptyWhen,
  emptyText = 'nothing here yet',
  emptyHint,
  children,
}: AsyncViewProps<T>) {
  if (state.loading) return <Spinner label={loadingLabel} />;
  if (state.error) {
    return <Text color={color.danger}>{state.error.message}</Text>;
  }
  if (state.data === undefined || (emptyWhen ? emptyWhen(state.data) : false)) {
    return <EmptyState text={emptyText} hint={emptyHint} />;
  }
  return <>{children(state.data)}</>;
}
