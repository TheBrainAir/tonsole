import { Box, Text } from 'ink';
import { useState } from 'react';
import type { AccountRef } from '../../engine/types.js';
import { TextField } from '../components/TextField.js';
import { ErrorBox } from '../components/ui.js';
import { useTonConnect } from '../tonconnect-context.js';

export function ConnectScreen({ account }: { account: AccountRef }) {
  const tc = useTonConnect();
  const [pass, setPass] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const doUnlock = () => {
    if (pass.length === 0) return;
    setBusy(true);
    tc.unlock(account, pass)
      .then(() => setPass(''))
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setBusy(false));
  };

  const doSubmit = () => {
    const url = link.trim();
    if (url.length === 0) return;
    setLink('');
    void tc.submitUrl(url);
  };

  if (error) {
    return (
      <Box flexDirection="column">
        <ErrorBox error={error} />
        <Text dimColor>esc back</Text>
      </Box>
    );
  }
  if (busy) {
    return <Text dimColor>unlocking…</Text>;
  }

  if (!tc.unlocked) {
    return (
      <Box flexDirection="column">
        <Text bold>TON Connect</Text>
        <Text dimColor>
          Unlock this wallet to approve dApp requests. The session stays active even after you leave
          this screen — requests pop up on any screen.
        </Text>
        <Box marginTop={1}>
          <TextField label="Passphrase" value={pass} onChange={setPass} onSubmit={doUnlock} mask focus />
        </Box>
        <Text dimColor>⏎ unlock · esc back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>TON Connect</Text>
      {tc.status ? <Text dimColor>{tc.status}</Text> : null}
      <Box marginTop={1}>
        <TextField
          label="Link"
          value={link}
          onChange={setLink}
          onSubmit={doSubmit}
          focus
          placeholder="paste a tc:// or https://…tonconnect link"
        />
      </Box>
      <Text dimColor>⏎ connect · esc back (session stays active)</Text>
    </Box>
  );
}
