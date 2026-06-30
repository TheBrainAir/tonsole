import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { StoredAccount } from '../../services/AccountService.js';
import { TextField } from '../components/TextField.js';
import { useApp } from '../context.js';

export function AccountsScreen({
  accounts,
  selectedId,
  onSelect,
  onReload,
}: {
  accounts: StoredAccount[];
  selectedId: string;
  onSelect: (id: string) => void;
  onReload: () => void;
}) {
  const app = useApp();
  const [idx, setIdx] = useState(() => {
    const i = accounts.findIndex((a) => a.id === selectedId);
    return i >= 0 ? i : 0;
  });
  const [mode, setMode] = useState<'list' | 'rename' | 'delete'>('list');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sel = Math.min(idx, accounts.length - 1);
  const current = accounts[sel];
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  useInput(
    (input, key) => {
      if (!current) return;
      if (mode === 'delete') {
        if (input === 'y') {
          try {
            app.accounts.remove(current.id);
            onReload();
          } catch (e) {
            fail(e);
          }
          setMode('list');
        } else if (input === 'n' || key.escape) {
          setMode('list');
        }
        return;
      }
      setError(null);
      if (key.upArrow || input === 'k') setIdx(Math.max(0, sel - 1));
      else if (key.downArrow || input === 'j') setIdx(Math.min(accounts.length - 1, sel + 1));
      else if (key.return) onSelect(current.id);
      else if (input === 'r') {
        setLabel(current.label ?? '');
        setMode('rename');
      } else if (input === 'd') {
        setMode('delete');
      }
    },
    { isActive: mode !== 'rename' },
  );

  if (!current) {
    return (
      <Box flexDirection="column">
        <Text bold>Accounts</Text>
        <Text dimColor>no wallets</Text>
      </Box>
    );
  }

  if (mode === 'rename') {
    return (
      <Box flexDirection="column">
        <Text bold>Rename wallet</Text>
        <Text dimColor>{current.account.address}</Text>
        <Box marginTop={1}>
          <TextField
            label="Label"
            value={label}
            onChange={setLabel}
            focus
            placeholder="e.g. Main, Savings (empty to clear)"
            onSubmit={() => {
              try {
                app.accounts.rename(current.id, label);
                onReload();
              } catch (e) {
                fail(e);
              }
              setMode('list');
            }}
          />
        </Box>
        <Text dimColor>⏎ save · esc back</Text>
      </Box>
    );
  }

  if (mode === 'delete') {
    return (
      <Box flexDirection="column">
        <Text bold color="red">
          Delete this wallet?
        </Text>
        <Text>
          {current.label ? `${current.label} · ` : ''}
          {current.account.address}
        </Text>
        <Text dimColor>Removes the keystore — only the 24-word phrase can restore it.</Text>
        <Box marginTop={1}>
          <Text>
            Delete? <Text color="cyan">[y/N]</Text>
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Accounts</Text>
      <Box flexDirection="column" marginTop={1}>
        {accounts.map((a, i) => (
          <Text key={a.id} color={i === sel ? 'cyan' : undefined}>
            {`${i === sel ? '❯' : ' '} ${a.id === selectedId ? '●' : ' '} `}
            {a.label ? `${a.label}  ` : ''}
            <Text dimColor>{a.account.address}</Text>
            <Text dimColor>{`  ${a.account.network} ${a.account.version}`}</Text>
          </Text>
        ))}
      </Box>
      {error ? <Text color="red">{error}</Text> : null}
      <Text dimColor>↑↓ navigate · ⏎ switch · r rename · d delete · esc back</Text>
    </Box>
  );
}
