import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { AppError } from '../../engine/errors.js';
import { SecretString } from '../../secrets/secret-string.js';
import { SelectList, type SelectItem } from '../components/SelectList.js';
import { TextField } from '../components/TextField.js';
import { ErrorBox } from '../components/ui.js';
import { useApp } from '../context.js';

type Mode = 'menu' | 'create-pass' | 'create-show' | 'import' | 'working' | 'error';

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const [mode, setMode] = useState<Mode>('menu');
  const [pass, setPass] = useState('');
  const [mnemonicInput, setMnemonicInput] = useState('');
  const [mnemonic, setMnemonic] = useState<string[] | null>(null);
  const [address, setAddress] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [importField, setImportField] = useState<'mnemonic' | 'pass'>('mnemonic');

  const fail = (e: unknown) => {
    setError(e instanceof Error ? e : new Error(String(e)));
    setMode('error');
  };

  const doCreate = () => {
    if (pass.length < 8) {
      fail(new AppError('WrongPassphrase', 'Passphrase must be at least 8 characters.'));
      return;
    }
    setMode('working');
    const passphrase = new SecretString(pass);
    app.accounts
      .create(passphrase)
      .then((res) => {
        setMnemonic(res.mnemonic);
        setAddress(res.account.address);
        setMode('create-show');
      })
      .catch(fail)
      .finally(() => passphrase.destroy());
  };

  const doImport = () => {
    if (pass.length < 8) {
      fail(new AppError('WrongPassphrase', 'Passphrase must be at least 8 characters.'));
      return;
    }
    setMode('working');
    const passphrase = new SecretString(pass);
    app.accounts
      .importMnemonic(mnemonicInput, passphrase)
      .then(() => onDone())
      .catch(fail)
      .finally(() => passphrase.destroy());
  };

  useInput(
    (_input, key) => {
      if (key.escape && (mode === 'create-pass' || mode === 'import')) setMode('menu');
      else if (key.return && mode === 'create-show') onDone();
      else if (key.return && mode === 'error') setMode('menu');
    },
    { isActive: mode !== 'menu' && mode !== 'working' },
  );

  if (mode === 'error' && error) {
    return (
      <Box flexDirection="column">
        <ErrorBox error={error} />
        <Text dimColor>enter to go back</Text>
      </Box>
    );
  }
  if (mode === 'working') {
    return <Text dimColor>working…</Text>;
  }

  if (mode === 'menu') {
    const items: SelectItem<'create' | 'import'>[] = [
      { label: 'Create a new wallet', value: 'create' },
      { label: 'Import a recovery phrase', value: 'import' },
    ];
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          Welcome to tonsole
        </Text>
        <Text dimColor>No wallet yet — let's set one up.</Text>
        <Box marginTop={1}>
          <SelectList
            items={items}
            onSelect={(v) => setMode(v === 'create' ? 'create-pass' : 'import')}
          />
        </Box>
      </Box>
    );
  }

  if (mode === 'create-pass') {
    return (
      <Box flexDirection="column">
        <Text bold>Create wallet</Text>
        <Text dimColor>Set a passphrase to encrypt your keystore (min 8 characters).</Text>
        <Box marginTop={1}>
          <TextField label="Passphrase" value={pass} onChange={setPass} onSubmit={doCreate} mask focus />
        </Box>
        <Text dimColor>⏎ to create · esc cancel</Text>
      </Box>
    );
  }

  if (mode === 'create-show' && mnemonic) {
    return (
      <Box flexDirection="column">
        <Text bold color="yellow">
          Write down these 24 words and store them offline — shown once.
        </Text>
        <Box flexDirection="column" marginTop={1}>
          <MnemonicGrid words={mnemonic} />
        </Box>
        <Box marginTop={1}>
          <Text color="green">Wallet: {address}</Text>
        </Box>
        <Text dimColor>enter when you've saved them</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Import wallet</Text>
      <Box marginTop={1} flexDirection="column">
        <TextField
          label="Phrase"
          value={mnemonicInput}
          onChange={setMnemonicInput}
          focus={importField === 'mnemonic'}
          onSubmit={() => setImportField('pass')}
          placeholder="your 24 words"
        />
        <TextField
          label="Pass  "
          value={pass}
          onChange={setPass}
          focus={importField === 'pass'}
          onSubmit={doImport}
          mask
          placeholder="keystore passphrase"
        />
      </Box>
      <Text dimColor>⏎ next · ⏎ on passphrase to import · esc cancel</Text>
    </Box>
  );
}

function MnemonicGrid({ words }: { words: string[] }) {
  const rows = [];
  for (let r = 0; r < 12; r++) {
    const left = words[r] ?? '';
    const right = words[r + 12] ?? '';
    rows.push(
      <Text key={r}>
        <Text dimColor>{`${String(r + 1).padStart(2)}. `}</Text>
        {left.padEnd(14)}
        <Text dimColor>{`${String(r + 13).padStart(2)}. `}</Text>
        {right}
      </Text>,
    );
  }
  return <>{rows}</>;
}
