import { Box, Text } from 'ink';
import { useState, type ReactNode } from 'react';
import { SecretString } from '../../secrets/secret-string.js';
import { ListView, MenuRow } from '../components/ListView.js';
import { CenteredModal, ConfirmBar } from '../components/Modal.js';
import { Panel } from '../components/Panel.js';
import { Spinner } from '../components/Spinner.js';
import { TextField } from '../components/TextField.js';
import { useApp } from '../context.js';
import { useKeymap } from '../shell/keymap.js';
import { useViewport } from '../shell/viewport.js';
import { color, symbol } from '../theme.js';

type Mode = 'menu' | 'create-pass' | 'create-show' | 'import' | 'working' | 'error';

const wordCount = (input: string): number => input.trim().split(/\s+/).filter(Boolean).length;

export function OnboardingScreen({
  onDone,
  embedded = false,
}: {
  onDone: () => void;
  /** True when pushed from the Accounts screen (adding another wallet):
   *  esc at the menu then falls through to the app-level "back". */
  embedded?: boolean;
}) {
  const app = useApp();
  const viewport = useViewport();
  const [mode, setMode] = useState<Mode>('menu');
  const [workingLabel, setWorkingLabel] = useState('working…');
  const [pass, setPass] = useState('');
  const [repeat, setRepeat] = useState('');
  const [passField, setPassField] = useState<'pass' | 'repeat'>('pass');
  const [passError, setPassError] = useState<string | null>(null);
  const [repeatError, setRepeatError] = useState<string | null>(null);
  const [mnemonicInput, setMnemonicInput] = useState('');
  const [mnemonicError, setMnemonicError] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string[] | null>(null);
  const [address, setAddress] = useState('');
  const [confirmSaved, setConfirmSaved] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [importField, setImportField] = useState<'mnemonic' | 'pass'>('mnemonic');

  const fail = (e: unknown) => {
    setError(e instanceof Error ? e : new Error(String(e)));
    setMode('error');
  };

  const toMenu = () => {
    setMode('menu');
    setPass('');
    setRepeat('');
    setPassField('pass');
    setPassError(null);
    setRepeatError(null);
    setMnemonicError(null);
    setImportField('mnemonic');
  };

  const toggleField = () => {
    if (mode === 'create-pass') setPassField((f) => (f === 'pass' ? 'repeat' : 'pass'));
    else if (mode === 'import') setImportField((f) => (f === 'mnemonic' ? 'pass' : 'mnemonic'));
  };

  const doCreate = () => {
    if (pass.length < 8) {
      setPassError('at least 8 characters');
      setPassField('pass');
      return;
    }
    setPassError(null);
    if (repeat !== pass) {
      setRepeatError('does not match the passphrase');
      setPassField('repeat');
      return;
    }
    setRepeatError(null);
    setWorkingLabel('creating your wallet…');
    setMode('working');
    const passphrase = new SecretString(pass);
    setPass('');
    setRepeat('');
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
    const words = wordCount(mnemonicInput);
    if (words !== 24) {
      setMnemonicError(`expected 24 words, got ${words}`);
      setImportField('mnemonic');
      return;
    }
    setMnemonicError(null);
    if (pass.length < 8) {
      setPassError('at least 8 characters');
      setImportField('pass');
      return;
    }
    setPassError(null);
    setWorkingLabel('importing your wallet…');
    setMode('working');
    const passphrase = new SecretString(pass);
    setPass('');
    app.accounts
      .importMnemonic(mnemonicInput, passphrase)
      .then(() => onDone())
      .catch(fail)
      .finally(() => passphrase.destroy());
  };

  // Form-mode keys: esc back to the menu, tab/↑↓ between fields.
  useKeymap(
    'screen',
    [
      { key: 'esc', label: 'back to menu', onPress: toMenu },
      { key: 'tab', onPress: toggleField },
      { key: '↑', match: (_i, k) => k.upArrow, onPress: toggleField },
      { key: '↓', match: (_i, k) => k.downArrow, onPress: toggleField },
    ],
    { isActive: mode === 'create-pass' || mode === 'import' },
  );
  useKeymap('screen', [{ key: '⏎', label: 'back to menu', onPress: toMenu }], {
    isActive: mode === 'error',
  });
  // Menu-mode hints (navigation itself lives in the ListView).
  useKeymap(
    'screen',
    [
      { key: '↑↓', label: 'move' },
      { key: '⏎', label: 'select' },
    ],
    { isActive: mode === 'menu' },
  );
  // While the wallet is being created/imported, and on the phrase card, nothing
  // may pop this screen (embedded mode has an app-level esc): an overlay scope
  // masks it. The phrase card's ⏎ lives on the same scope.
  useKeymap(
    'overlay',
    mode === 'create-show'
      ? [{ key: '⏎', label: 'I have written them down', onPress: () => setConfirmSaved(true) }]
      : [],
    { isActive: mode === 'working' || (mode === 'create-show' && !confirmSaved) },
  );

  const card = (title: string, step: string | null, body: ReactNode, tone?: 'warning' | 'danger') => (
    <Box
      flexDirection="column"
      flexGrow={viewport.isFullscreen ? 1 : undefined}
      justifyContent="center"
      alignItems="center"
    >
      <Panel width={Math.min(72, viewport.contentWidth)} title={title} tone={tone}>
        {step ? <Text dimColor>{step}</Text> : null}
        {body}
      </Panel>
    </Box>
  );

  if (mode === 'error' && error) {
    return card(
      'Something went wrong',
      null,
      <Box flexDirection="column" marginTop={1}>
        <Text color={color.danger}>{error.message}</Text>
        <Box marginTop={1}>
          <Text>
            <Text color={color.accent}>⏎</Text>
            <Text dimColor> back to the menu</Text>
          </Text>
        </Box>
      </Box>,
      'danger',
    );
  }

  if (mode === 'working') {
    return card(
      embedded ? 'Add a wallet' : 'Welcome to tonsole',
      null,
      <Box marginTop={1}>
        <Spinner label={workingLabel} />
      </Box>,
    );
  }

  if (mode === 'menu') {
    const items = [
      { label: 'Create a new wallet', hint: 'fresh 24-word recovery phrase', value: 'create' as const },
      { label: 'Import a recovery phrase', hint: 'restore an existing wallet', value: 'import' as const },
    ];
    return card(
      embedded ? 'Add a wallet' : 'Welcome to tonsole',
      embedded ? 'It will live beside your other wallets.' : "No wallet yet — let's set one up.",
      <Box flexDirection="column" marginTop={1}>
        <ListView
          items={items}
          wrap
          maxVisible={items.length}
          renderItem={(item, { selected }) => (
            <MenuRow label={item.label} hint={item.hint} selected={selected} />
          )}
          onActivate={(item) => setMode(item.value === 'create' ? 'create-pass' : 'import')}
        />
      </Box>,
    );
  }

  if (mode === 'create-pass') {
    return card(
      'Create wallet',
      `Create ▸ 1 passphrase ${symbol.bullet} 2 recovery phrase ${symbol.bullet} 3 done`,
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>The passphrase encrypts your keystore on this machine.</Text>
        <Box flexDirection="column" marginTop={1}>
          <TextField
            label="Passphrase"
            value={pass}
            onChange={(v) => {
              setPass(v);
              setPassError(null);
            }}
            onSubmit={() => setPassField('repeat')}
            focus={passField === 'pass'}
            mask
            error={passError}
            helper="min 8 characters"
          />
          <TextField
            label="Repeat"
            value={repeat}
            onChange={(v) => {
              setRepeat(v);
              setRepeatError(null);
            }}
            onSubmit={doCreate}
            focus={passField === 'repeat'}
            mask
            error={repeatError}
            placeholder="same passphrase again"
          />
        </Box>
      </Box>,
    );
  }

  if (mode === 'create-show' && mnemonic) {
    return (
      <>
        <Box
          display={confirmSaved ? 'none' : 'flex'}
          flexDirection="column"
          flexGrow={viewport.isFullscreen ? 1 : undefined}
          justifyContent="center"
          alignItems="center"
        >
          {/* The 24 words sit right under the title: on a too-short terminal the
              shell clips this panel from the BOTTOM, so the words must never be
              what gets cut off. */}
          <Panel
            tone="warning"
            width={Math.min(72, viewport.contentWidth)}
            title="Your recovery phrase — shown once"
          >
            <Box flexDirection="column" marginTop={1}>
              <MnemonicGrid words={mnemonic} columns={viewport.contentWidth >= 58 ? 3 : 2} />
            </Box>
            <Box marginTop={1}>
              <Text>
                <Text dimColor>Wallet </Text>
                <Text color={color.success}>{address}</Text>
              </Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text color={color.warning}>
                ⚠ Write these 24 words on paper, in order. Anyone who has them controls your
                funds. They are never shown again and never stored by tonsole.
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text>
                <Text color={color.accent}>⏎</Text>
                <Text dimColor> I have written them down</Text>
              </Text>
            </Box>
          </Panel>
        </Box>
        {confirmSaved ? (
          <CenteredModal
            title="Are you sure?"
            tone="warning"
            width={56}
            bindings={[
              { key: 'y', label: 'yes, continue', onPress: () => onDone() },
              { key: 'n', label: 'show the phrase again', onPress: () => setConfirmSaved(false) },
              { key: 'esc', onPress: () => setConfirmSaved(false) },
            ]}
            footer={<ConfirmBar verb="continue" cancelLabel="show the phrase again" />}
          >
            <Box marginTop={1}>
              <Text>The 24 words will not be shown again. Did you write them down?</Text>
            </Box>
          </CenteredModal>
        ) : null}
      </>
    );
  }

  const words = wordCount(mnemonicInput);
  return card(
    'Import wallet',
    `Import ▸ 1 recovery phrase ${symbol.bullet} 2 passphrase`,
    <Box flexDirection="column" marginTop={1}>
      <TextField
        label="Phrase"
        value={mnemonicInput}
        onChange={(v) => {
          setMnemonicInput(v);
          setMnemonicError(null);
        }}
        onSubmit={() => setImportField('pass')}
        focus={importField === 'mnemonic'}
        placeholder="your 24 words — paste is fine"
        error={mnemonicError}
        helper={words > 0 ? `${words}/24 words` : 'space-separated, in order'}
        width={Math.min(48, Math.max(16, viewport.contentWidth - 24))}
      />
      <TextField
        label="Passphrase"
        value={pass}
        onChange={(v) => {
          setPass(v);
          setPassError(null);
        }}
        onSubmit={doImport}
        focus={importField === 'pass'}
        mask
        error={passError}
        helper="encrypts the keystore on this machine (min 8 characters)"
      />
    </Box>,
  );
}

function MnemonicGrid({ words, columns }: { words: string[]; columns: 2 | 3 }) {
  const perColumn = Math.ceil(words.length / columns);
  const rows = [];
  for (let r = 0; r < perColumn; r++) {
    const cells = [];
    for (let c = 0; c < columns; c++) {
      const i = c * perColumn + r;
      const word = words[i];
      if (word === undefined) continue;
      cells.push(
        <Text key={c}>
          <Text dimColor>{`${String(i + 1).padStart(2)}. `}</Text>
          <Text bold>{word.padEnd(columns === 3 ? 12 : 14)}</Text>
        </Text>,
      );
    }
    rows.push(<Text key={r}>{cells}</Text>);
  }
  return <>{rows}</>;
}
