import { Box, Text } from 'ink';
import { useState } from 'react';
import type { StoredAccount } from '../../services/AccountService.js';
import { shortenAddress } from '../../domain/address.js';
import { ListView } from '../components/ListView.js';
import { CenteredModal, ConfirmBar } from '../components/Modal.js';
import { Panel } from '../components/Panel.js';
import { Spinner } from '../components/Spinner.js';
import { TextField } from '../components/TextField.js';
import { Field, TonAmount } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';
import { useKeymap } from '../shell/keymap.js';
import { useFlash } from '../shell/StatusBar.js';
import { useViewport } from '../shell/viewport.js';
import { color, symbol } from '../theme.js';

type Mode = 'list' | 'rename' | 'delete';

export function AccountsScreen({
  accounts,
  selectedId,
  onSelect,
  onReload,
  onAddWallet,
}: {
  accounts: StoredAccount[];
  selectedId: string;
  onSelect: (id: string) => void;
  onReload: () => void;
  onAddWallet: () => void;
}) {
  const app = useApp();
  const viewport = useViewport();
  const flash = useFlash();
  const [idx, setIdx] = useState(() => {
    const i = accounts.findIndex((a) => a.id === selectedId);
    return i >= 0 ? i : 0;
  });
  const [mode, setMode] = useState<Mode>('list');
  const [label, setLabel] = useState('');

  const sel = Math.min(idx, Math.max(0, accounts.length - 1));
  const current = accounts[sel];

  // Balance of the highlighted wallet, fetched lazily per highlight.
  const balance = useAsync(
    async () => (current ? app.balances.getTon(current.account) : null),
    [current?.account.address],
  );

  useKeymap(
    'screen',
    [
      { key: '↑↓', label: 'move' },
      { key: '⏎', label: 'switch' },
      {
        key: 'r',
        label: 'rename',
        onPress: () => {
          if (!current) return;
          setLabel(current.label ?? '');
          setMode('rename');
        },
      },
      {
        key: 'd',
        label: 'delete',
        onPress: () => {
          if (current) setMode('delete');
        },
      },
      { key: 'n', label: 'new wallet', onPress: onAddWallet },
    ],
    { isActive: mode === 'list' && accounts.length > 0 },
  );

  if (!current) {
    return (
      <Panel title="Accounts">
        <Text dimColor>no wallets</Text>
      </Panel>
    );
  }

  const doRename = () => {
    try {
      app.accounts.rename(current.id, label);
      onReload();
      flash(label.trim() ? `✓ renamed to "${label.trim()}"` : '✓ label cleared');
    } catch (e) {
      flash(`✗ ${e instanceof Error ? e.message : String(e)}`, 'danger');
    }
    setMode('list');
  };

  const doDelete = () => {
    try {
      app.accounts.remove(current.id);
      onReload();
      setIdx(0);
      flash('✓ wallet removed');
    } catch (e) {
      flash(`✗ ${e instanceof Error ? e.message : String(e)}`, 'danger');
    }
    setMode('list');
  };

  const wide = viewport.breakpoint === 'wide';

  const listPanel = (
    <Panel
      title={
        <Text bold>
          Accounts <Text dimColor>{`${accounts.length} wallet${accounts.length === 1 ? '' : 's'}`}</Text>
        </Text>
      }
      flexGrow={wide ? 1 : undefined}
    >
      <Box marginTop={1} flexDirection="column">
        <ListView
          items={accounts}
          selected={sel}
          onSelectionChange={setIdx}
          isActive={mode === 'list'}
          reservedRows={wide ? 4 : 14}
          onActivate={(a) => onSelect(a.id)}
          renderItem={(a, { selected }) => (
            <Text color={selected ? color.brand : undefined} wrap="truncate">
              {`${selected ? symbol.pointer : ' '} ${a.id === selectedId ? symbol.dot : ' '} `}
              {a.label ? `${a.label}  ` : ''}
              <Text dimColor>{shortenAddress(a.account.address)}</Text>
              <Text dimColor>{`  ${a.account.network} ${symbol.bullet} ${a.account.version}`}</Text>
            </Text>
          )}
        />
      </Box>
    </Panel>
  );

  const detailPanel = (
    <Panel title={current.label ?? shortenAddress(current.account.address)}>
      <Box marginTop={1} flexDirection="column">
        <Field label="address">
          <Text color={color.address}>{current.account.address}</Text>
        </Field>
        <Field label="balance">
          {balance.loading ? (
            <Spinner label="" />
          ) : balance.data ? (
            <TonAmount nano={balance.data.nano} />
          ) : (
            <Text dimColor>unavailable</Text>
          )}
        </Field>
        <Field label="network">
          {current.account.network} {symbol.bullet} wallet {current.account.version}
        </Field>
        {current.id === selectedId ? (
          <Box marginTop={1}>
            <Text color={color.success}>{symbol.dot} currently selected</Text>
          </Box>
        ) : null}
      </Box>
    </Panel>
  );

  return (
    <>
      <Box display={mode === 'list' ? 'flex' : 'none'} flexDirection={wide ? 'row' : 'column'}>
        {wide ? (
          <>
            {listPanel}
            <Box flexDirection="column" width={50} flexShrink={0} marginLeft={1}>
              {detailPanel}
            </Box>
          </>
        ) : (
          <Box flexDirection="column">
            {listPanel}
            <Box marginTop={1} flexDirection="column">
              {detailPanel}
            </Box>
          </Box>
        )}
      </Box>

      {mode === 'rename' ? (
        <CenteredModal
          title="Rename wallet"
          width={60}
          bindings={[{ key: 'esc', label: 'cancel', onPress: () => setMode('list') }]}
        >
          <Box marginTop={1} flexDirection="column">
            <Text dimColor wrap="truncate-middle">
              {current.account.address}
            </Text>
            <Box marginTop={1}>
              <TextField
                label="Label"
                value={label}
                onChange={setLabel}
                focus
                placeholder="e.g. Main, Savings (empty to clear)"
                helper="⏎ save"
                onSubmit={doRename}
              />
            </Box>
          </Box>
        </CenteredModal>
      ) : null}

      {mode === 'delete' ? (
        <CenteredModal
          title="Delete this wallet?"
          tone="danger"
          width={64}
          bindings={[
            { key: 'y', label: 'delete', onPress: doDelete },
            { key: 'n', label: 'keep it', onPress: () => setMode('list') },
            { key: 'esc', onPress: () => setMode('list') },
          ]}
          footer={<ConfirmBar verb="delete" cancelLabel="keep it" />}
        >
          <Box marginTop={1} flexDirection="column">
            <Text>
              {current.label ? `${current.label}${symbol.sep}` : ''}
              <Text color={color.address}>{current.account.address}</Text>
            </Text>
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>Removes the keystore — only the 24-word phrase can restore it.</Text>
              {current.id === selectedId ? (
                <Text color={color.warning}>⚠ This is the wallet you are currently using.</Text>
              ) : null}
              {accounts.length === 1 ? (
                <Text color={color.warning}>⚠ This is your only wallet.</Text>
              ) : null}
            </Box>
          </Box>
        </CenteredModal>
      ) : null}
    </>
  );
}
