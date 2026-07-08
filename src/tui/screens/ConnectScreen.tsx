import { Box, Text } from 'ink';
import { useEffect, useState } from 'react';
import type { AccountRef } from '../../engine/types.js';
import { ListView } from '../components/ListView.js';
import { Panel } from '../components/Panel.js';
import { Spinner } from '../components/Spinner.js';
import { TextField } from '../components/TextField.js';
import { useKeymap } from '../shell/keymap.js';
import { useFlash } from '../shell/StatusBar.js';
import { useViewport } from '../shell/viewport.js';
import { color, symbol } from '../theme.js';
import { useTonConnect } from '../tonconnect-context.js';

export function ConnectScreen({ account }: { account: AccountRef }) {
  const tc = useTonConnect();
  const viewport = useViewport();
  const flash = useFlash();
  const [pass, setPass] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pane, setPane] = useState<'link' | 'sessions'>('link');
  const [sessionIdx, setSessionIdx] = useState(0);

  const sessions = tc.sessions ?? [];

  useEffect(() => {
    if (tc.unlocked) void tc.refreshSessions?.();
  }, [tc.unlocked]);

  // Disconnecting the last dApp while in the sessions pane would otherwise
  // strand the screen with no focused pane (the list is gone, the link field
  // is unfocused, tab is unregistered).
  useEffect(() => {
    if (pane === 'sessions' && sessions.length === 0) setPane('link');
  }, [pane, sessions.length]);

  const doUnlock = () => {
    if (pass.length === 0) return;
    setBusy(true);
    setError(null);
    tc.unlock(account, pass)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        setBusy(false);
        setPass(''); // clear on both success and error, not just success
      });
  };

  const doSubmit = () => {
    const url = link.trim();
    if (url.length === 0) return;
    setLink('');
    void tc.submitUrl(url);
  };

  const canManage = tc.unlocked && sessions.length > 0;

  useKeymap(
    'screen',
    [
      ...(canManage
        ? [{ key: 'tab', label: 'switch pane', onPress: () => setPane((p) => (p === 'link' ? 'sessions' : 'link')) }]
        : []),
      ...(pane === 'sessions' && canManage
        ? [
            {
              key: 'd',
              label: 'disconnect',
              onPress: () => {
                const s = sessions[Math.min(sessionIdx, sessions.length - 1)];
                if (!s) return;
                void tc
                  .disconnect?.(s.id)
                  .then(() => flash(`✓ disconnected ${s.name ?? 'dApp'}`))
                  .catch(() => flash('✗ could not disconnect', 'danger'));
              },
            },
            {
              key: 'D',
              label: 'disconnect all',
              onPress: () => {
                void tc
                  .disconnect?.()
                  .then(() => flash('✓ all dApps disconnected'))
                  .catch(() => flash('✗ could not disconnect', 'danger'));
              },
            },
          ]
        : []),
    ],
    { isActive: tc.unlocked && !busy },
  );

  if (!tc.unlocked) {
    return (
      <Box
        flexDirection="column"
        flexGrow={viewport.isFullscreen ? 1 : undefined}
        justifyContent="center"
        alignItems="center"
      >
        <Panel title="TON Connect" width={Math.min(68, viewport.contentWidth)}>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>
              Unlock this wallet to approve dApp requests. The session stays active even after
              you leave this screen — requests pop up on any screen.
            </Text>
            <Box marginTop={1} flexDirection="column">
              {busy ? (
                <Spinner label="unlocking…" />
              ) : (
                <TextField
                  label="Passphrase"
                  value={pass}
                  onChange={(v) => {
                    setPass(v);
                    setError(null);
                  }}
                  onSubmit={doUnlock}
                  mask
                  focus
                  error={error}
                  helper="⏎ unlock"
                />
              )}
            </Box>
          </Box>
        </Panel>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Panel
        title={
          <Text bold>
            Connected dApps{' '}
            <Text dimColor>
              {sessions.length > 0 ? `${sessions.length}` : ''}
              {pane === 'sessions' ? `${symbol.sep}active pane` : ''}
            </Text>
          </Text>
        }
      >
        <Box marginTop={1} flexDirection="column">
          {sessions.length === 0 ? (
            <Text dimColor>no dApps connected — paste a link below</Text>
          ) : (
            <ListView
              items={sessions}
              selected={Math.min(sessionIdx, sessions.length - 1)}
              onSelectionChange={setSessionIdx}
              isActive={pane === 'sessions'}
              maxVisible={6}
              renderItem={(s, { selected }) => (
                <Text color={selected && pane === 'sessions' ? color.brand : undefined} wrap="truncate">
                  {selected && pane === 'sessions' ? `${symbol.pointer} ` : '  '}
                  <Text color={color.success}>{symbol.dot}</Text> {s.name ?? 'dApp'}
                  {s.url ? <Text dimColor>{`  ${s.url}`}</Text> : null}
                </Text>
              )}
            />
          )}
        </Box>
      </Panel>
      <Panel title="New connection" marginTop={1} tone={pane === 'link' ? 'focus' : 'default'}>
        <Box marginTop={1} flexDirection="column">
          <TextField
            label="Link"
            value={link}
            onChange={setLink}
            onSubmit={doSubmit}
            focus={pane === 'link'}
            placeholder="paste a tc:// or https://…tonconnect link, then ⏎"
            width={Math.min(64, Math.max(16, viewport.contentWidth - 24))}
          />
        </Box>
      </Panel>
      {tc.status ? (
        <Box marginTop={1}>
          <Text dimColor wrap="truncate">
            {tc.status}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
