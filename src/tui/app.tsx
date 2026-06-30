import { Box, Text, useApp as useInkApp, useInput } from 'ink';
import { useMemo, useRef, useState } from 'react';
import type { App } from '../composition.js';
import { AppError } from '../engine/errors.js';
import type { ConnectRequest, ConnectTxRequest } from '../engine/types.js';
import type { TonConnect } from '../engine/WalletEngine.js';
import { SecretString } from '../secrets/secret-string.js';
import type { StoredAccount } from '../services/AccountService.js';
import { ConnectPrompt, TxPrompt } from './components/RequestPrompt.js';
import { AppProvider, useApp } from './context.js';
import { AccountsScreen } from './screens/AccountsScreen.js';
import { ConnectScreen } from './screens/ConnectScreen.js';
import { DashboardScreen } from './screens/DashboardScreen.js';
import { HistoryScreen } from './screens/HistoryScreen.js';
import { JettonsScreen } from './screens/JettonsScreen.js';
import { NftScreen } from './screens/NftScreen.js';
import { OnboardingScreen } from './screens/OnboardingScreen.js';
import { ReceiveScreen } from './screens/ReceiveScreen.js';
import { type SendPreset, SendScreen } from './screens/SendScreen.js';
import { type TonConnectController, TonConnectProvider } from './tonconnect-context.js';

export type Screen =
  | 'dashboard'
  | 'send'
  | 'receive'
  | 'history'
  | 'jettons'
  | 'nft'
  | 'connect'
  | 'accounts';

export function TonsoleApp({ app }: { app: App }) {
  return (
    <AppProvider value={app}>
      <Root />
    </AppProvider>
  );
}

function Root() {
  const app = useApp();
  const [version, setVersion] = useState(0);
  const accounts = useMemo(() => app.accounts.list(), [app, version]);
  const reload = () => setVersion((v) => v + 1);

  if (accounts.length === 0) {
    return <OnboardingScreen onDone={reload} />;
  }
  return <Main accounts={accounts} />;
}

function Main({ accounts }: { accounts: StoredAccount[] }) {
  const app = useApp();
  const { exit } = useInkApp();
  const [selectedId, setSelectedId] = useState(
    accounts.find((a) => a.isDefault)?.id ?? accounts[0]!.id,
  );
  const [stack, setStack] = useState<Screen[]>(['dashboard']);
  const selected = accounts.find((a) => a.id === selectedId) ?? accounts[0]!;
  const screen = stack[stack.length - 1]!;

  const push = (s: Screen) => setStack((st) => [...st, s]);
  const back = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));

  const [sendPreset, setSendPreset] = useState<SendPreset | null>(null);
  const goSend = (preset: SendPreset | null) => {
    setSendPreset(preset);
    push('send');
  };

  // ── TON Connect, hoisted to the app level so the session survives leaving the
  //    Connect screen and dApp requests pop up over whatever screen is showing. ──
  const tcRef = useRef<TonConnect | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [tcStatus, setTcStatus] = useState('');
  const [tcError, setTcError] = useState<string | null>(null);
  const [pendingConnect, setPendingConnect] = useState<ConnectRequest | null>(null);
  const [pendingTx, setPendingTx] = useState<ConnectTxRequest | null>(null);
  const connectResolver = useRef<((ok: boolean) => void) | null>(null);
  const txResolver = useRef<((ok: boolean) => void) | null>(null);

  const controller: TonConnectController = {
    unlocked,
    status: tcStatus,
    unlock: async (account, passphrase) => {
      const handle = app.engine.tonConnect?.();
      if (!handle) throw new AppError('EngineUnsupported', 'TON Connect is unavailable with this engine.');
      const secret = new SecretString(passphrase);
      try {
        const ctx = app.accounts.signingContext(app.accounts.resolve(account.address), secret);
        await handle.unlock(account, ctx);
      } finally {
        secret.destroy();
      }
      handle.onConnectRequest(
        (req) =>
          new Promise<boolean>((resolve) => {
            setPendingConnect(req);
            connectResolver.current = resolve;
          }),
      );
      handle.onTransactionRequest(
        (req) =>
          new Promise<boolean>((resolve) => {
            setPendingTx(req);
            txResolver.current = resolve;
          }),
      );
      handle.onError((message) => {
        setTcStatus(`Error: ${message}`);
        setTcError(message);
      });
      handle.onDisconnect(() => setTcStatus('the dApp disconnected'));
      tcRef.current = handle;
      setUnlocked(true);
      setTcStatus('Unlocked — paste a dApp link. Requests appear here on any screen.');
    },
    submitUrl: async (url) => {
      const handle = tcRef.current;
      if (!handle) return;
      setTcStatus('Connecting…');
      try {
        await handle.submitUrl(url);
        setTcStatus('Waiting for the dApp…');
      } catch (e) {
        setTcStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  };

  const resolveConnect = (ok: boolean) => {
    connectResolver.current?.(ok);
    connectResolver.current = null;
    setPendingConnect(null);
    setTcStatus(ok ? 'Connected ✓ — waiting for dApp requests.' : 'Connection rejected.');
  };
  const resolveTx = (ok: boolean) => {
    txResolver.current?.(ok);
    txResolver.current = null;
    setPendingTx(null);
    setTcStatus(ok ? 'Approved — broadcasting…' : 'Transaction rejected.');
  };

  const pending = pendingConnect !== null || pendingTx !== null;

  useInput((input, key) => {
    if (tcError) setTcError(null); // any key dismisses the error banner, then acts normally
    if (pendingConnect) {
      if (input === 'y') resolveConnect(true);
      else if (input === 'n' || key.escape) resolveConnect(false);
      return;
    }
    if (pendingTx) {
      if (input === 'y') resolveTx(true);
      else if (input === 'n' || key.escape) resolveTx(false);
      return;
    }
    if (key.escape && stack.length > 1) back();
    else if (input === 'q' && stack.length === 1) exit();
  });

  return (
    <TonConnectProvider value={controller}>
      <Box flexDirection="column" paddingX={1}>
        <Header account={selected} connected={unlocked} />
        {tcError ? (
          <Box marginTop={1}>
            <Text color="red">⚠ dApp request rejected: {tcError} </Text>
            <Text dimColor>(any key dismisses)</Text>
          </Box>
        ) : null}
        <Box marginTop={1} flexDirection="column">
          {pendingConnect ? (
            <ConnectPrompt req={pendingConnect} />
          ) : pendingTx ? (
            <TxPrompt req={pendingTx} />
          ) : (
            <CurrentScreen
              screen={screen}
              account={selected}
              accounts={accounts}
              selectedId={selectedId}
              sendPreset={sendPreset}
              onNavigate={(s) => (s === 'send' ? goSend(null) : push(s))}
              onSend={goSend}
              onSelectAccount={(id) => {
                setSelectedId(id);
                back();
              }}
              onSendDone={() => {
                setSendPreset(null);
                back();
              }}
            />
          )}
        </Box>
        <Footer atRoot={stack.length === 1} pending={pending} />
      </Box>
    </TonConnectProvider>
  );
}

function CurrentScreen({
  screen,
  account,
  accounts,
  selectedId,
  sendPreset,
  onNavigate,
  onSend,
  onSelectAccount,
  onSendDone,
}: {
  screen: Screen;
  account: StoredAccount;
  accounts: StoredAccount[];
  selectedId: string;
  sendPreset: SendPreset | null;
  onNavigate: (s: Screen) => void;
  onSend: (preset: SendPreset) => void;
  onSelectAccount: (id: string) => void;
  onSendDone: () => void;
}) {
  switch (screen) {
    case 'send':
      return <SendScreen account={account.account} onDone={onSendDone} preset={sendPreset} />;
    case 'receive':
      return <ReceiveScreen account={account.account} />;
    case 'history':
      return <HistoryScreen account={account.account} />;
    case 'jettons':
      return <JettonsScreen account={account.account} onSend={onSend} />;
    case 'nft':
      return <NftScreen account={account.account} onSend={onSend} />;
    case 'connect':
      return <ConnectScreen account={account.account} />;
    case 'accounts':
      return <AccountsScreen accounts={accounts} selectedId={selectedId} onSelect={onSelectAccount} />;
    default:
      return (
        <DashboardScreen
          account={account.account}
          onNavigate={onNavigate}
          multipleAccounts={accounts.length > 1}
        />
      );
  }
}

function Header({ account, connected }: { account: StoredAccount; connected: boolean }) {
  return (
    <Box justifyContent="space-between">
      <Text>
        <Text bold color="cyan">
          tonsole
        </Text>
        <Text dimColor> · {account.account.network}</Text>
        {connected ? <Text color="green"> · 🔗 connected</Text> : null}
      </Text>
      <Text color="yellow">{account.account.address}</Text>
    </Box>
  );
}

function Footer({ atRoot, pending }: { atRoot: boolean; pending: boolean }) {
  if (pending) {
    return (
      <Box marginTop={1}>
        <Text dimColor>y approve · n/esc reject</Text>
      </Box>
    );
  }
  return (
    <Box marginTop={1}>
      <Text dimColor>{atRoot ? '↑↓ move · ⏎ select · q quit' : 'esc back'}</Text>
    </Box>
  );
}
