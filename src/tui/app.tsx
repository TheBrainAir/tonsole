import { Box, Text, useApp as useInkApp, useInput } from 'ink';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { App } from '../composition.js';
import { saveConfigPatch } from '../config/config.js';
import { DISCLAIMER_VERSION } from '../config/schema.js';
import { sameAddress } from '../domain/address.js';
import { AppError } from '../engine/errors.js';
import type {
  AccountRef,
  ConnectRequest,
  ConnectTxRequest,
  TonConnectSessionInfo,
} from '../engine/types.js';
import type { TonConnect } from '../engine/WalletEngine.js';
import { SecretString } from '../secrets/secret-string.js';
import type { StoredAccount } from '../services/AccountService.js';
import { ConnectPrompt, TxPrompt } from './components/RequestPrompt.js';
import { AppProvider, useApp } from './context.js';
import { AccountsScreen } from './screens/AccountsScreen.js';
import { ConnectScreen } from './screens/ConnectScreen.js';
import { DisclaimerScreen } from './screens/DisclaimerScreen.js';
import { DashboardScreen } from './screens/DashboardScreen.js';
import { JettonsScreen, NftScreen } from './screens/GalleryScreen.js';
import { HistoryScreen } from './screens/HistoryScreen.js';
import { OnboardingScreen } from './screens/OnboardingScreen.js';
import { ReceiveScreen } from './screens/ReceiveScreen.js';
import { type SendPreset, SendScreen } from './screens/SendScreen.js';
import { AppShell } from './shell/AppShell.js';
import { KeymapProvider, useKeymap } from './shell/keymap.js';
import { ViewportProvider } from './shell/viewport.js';
import { color } from './theme.js';
import { type TonConnectController, TonConnectProvider } from './tonconnect-context.js';

export type Screen =
  | 'dashboard'
  | 'send'
  | 'receive'
  | 'history'
  | 'jettons'
  | 'nft'
  | 'connect'
  | 'accounts'
  | 'add-wallet';

export function TonsoleApp({ app, fullscreen = false }: { app: App; fullscreen?: boolean }) {
  return (
    <AppProvider value={app}>
      <ViewportProvider fullscreen={fullscreen}>
        <KeymapProvider>
          <Root />
        </KeymapProvider>
      </ViewportProvider>
    </AppProvider>
  );
}

function Root() {
  const app = useApp();
  const [version, setVersion] = useState(0);
  const [accepted, setAccepted] = useState(
    app.config.disclaimerAcceptedVersion === DISCLAIMER_VERSION,
  );
  const accounts = useMemo(() => app.accounts.list(), [app, version]);
  const reload = () => setVersion((v) => v + 1);

  if (!accepted) {
    return (
      <AppShell stage="disclaimer" network={app.config.network}>
        <DisclaimerScreen
          onAccept={() => {
            try {
              saveConfigPatch({ disclaimerAcceptedVersion: DISCLAIMER_VERSION });
              app.config.disclaimerAcceptedVersion = DISCLAIMER_VERSION;
            } catch {
              // If persisting fails, still proceed this session rather than blocking use.
            }
            setAccepted(true);
          }}
        />
      </AppShell>
    );
  }
  if (accounts.length === 0) {
    return (
      <AppShell stage="onboarding" network={app.config.network}>
        <OnboardingScreen onDone={reload} />
      </AppShell>
    );
  }
  return <Main accounts={accounts} onReload={reload} />;
}

function Main({ accounts, onReload }: { accounts: StoredAccount[]; onReload: () => void }) {
  const app = useApp();
  const { exit } = useInkApp();
  const [selectedId, setSelectedId] = useState(
    accounts.find((a) => a.isDefault)?.id ?? accounts[0]!.id,
  );
  const [stack, setStack] = useState<Screen[]>(['dashboard']);
  const selected = accounts.find((a) => a.id === selectedId) ?? accounts[0]!;
  const screen = stack[stack.length - 1]!;

  // Deleting the active wallet leaves selectedId dangling — re-point it so the
  // "currently selected" markers and delete warnings stay truthful.
  useEffect(() => {
    if (!accounts.some((a) => a.id === selectedId)) {
      const next = accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id;
      if (next) setSelectedId(next);
    }
  }, [accounts, selectedId]);

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
  // The account the TON Connect session is bound to (may differ from the selected one).
  const [connectedAccount, setConnectedAccount] = useState<AccountRef | null>(null);
  const [tcStatus, setTcStatus] = useState('');
  const [tcError, setTcError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<TonConnectSessionInfo[]>([]);
  // dApp requests are QUEUED, one prompt at a time: a second request arriving
  // while the user reads the first must neither swap the prompt mid-read (the
  // y would approve something the user never saw) nor orphan the first
  // request's resolver (the dApp would hang with no response).
  const [connectQueue, setConnectQueue] = useState<
    { req: ConnectRequest; resolve: (ok: boolean) => void }[]
  >([]);
  const [txQueue, setTxQueue] = useState<
    { req: ConnectTxRequest; resolve: (ok: boolean) => void }[]
  >([]);
  const pendingConnect = connectQueue[0]?.req ?? null;
  const pendingTx = txQueue[0]?.req ?? null;

  const refreshSessions = async () => {
    const handle = tcRef.current;
    if (!handle) return;
    try {
      setSessions(await handle.listSessions());
    } catch {
      // keep the stale list rather than erroring the UI
    }
  };

  const controller: TonConnectController = {
    unlocked,
    status: tcStatus,
    sessions,
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
            setConnectQueue((q) => [...q, { req, resolve }]);
          }),
      );
      handle.onTransactionRequest(
        (req) =>
          new Promise<boolean>((resolve) => {
            setTxQueue((q) => [...q, { req, resolve }]);
          }),
      );
      handle.onError((message) => {
        setTcStatus(`Error: ${message}`);
        setTcError(message);
      });
      handle.onDisconnect(() => {
        setTcStatus('the dApp disconnected');
        void refreshSessions();
      });
      tcRef.current = handle;
      setUnlocked(true);
      setConnectedAccount(account);
      setTcStatus('Unlocked — paste a dApp link. Requests appear here on any screen.');
      void refreshSessions();
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
    refreshSessions,
    disconnect: async (sessionId) => {
      const handle = tcRef.current;
      if (!handle) return;
      await handle.disconnect(sessionId);
      await refreshSessions();
    },
  };

  const resolveConnect = (ok: boolean) => {
    const head = connectQueue[0];
    if (!head) return;
    head.resolve(ok);
    setConnectQueue((q) => q.slice(1));
    setTcStatus(ok ? 'Connected ✓ — waiting for dApp requests.' : 'Connection rejected.');
    if (ok) void refreshSessions();
  };
  const resolveTx = (ok: boolean) => {
    const head = txQueue[0];
    if (!head) return;
    head.resolve(ok);
    setTxQueue((q) => q.slice(1));
    setTcStatus(ok ? 'Approved — broadcasting…' : 'Transaction rejected.');
  };

  const pending = pendingConnect !== null || pendingTx !== null;
  const atRoot = stack.length === 1;

  // Any key dismisses the dApp error banner; a non-consuming observer beside
  // the keymap, so the key still performs its normal action.
  useInput(() => setTcError(null), { isActive: tcError !== null });

  useKeymap('app', [
    { key: 'esc', label: atRoot ? undefined : 'back', onPress: () => back() },
    {
      key: 'q',
      label: atRoot ? 'quit' : undefined,
      onPress: () => {
        if (atRoot) exit();
      },
    },
  ]);

  const signerStored = connectedAccount
    ? accounts.find((a) => sameAddress(a.account.address, connectedAccount.address))
    : undefined;

  const banner = tcError ? (
    <Box marginTop={1}>
      <Text color={color.danger} wrap="truncate">
        ⚠ dApp request rejected: {tcError}{' '}
      </Text>
      <Text dimColor>(any key dismisses)</Text>
    </Box>
  ) : null;

  return (
    <TonConnectProvider value={controller}>
      <AppShell
        stage="main"
        network={selected.account.network}
        account={{ label: selected.label, address: selected.account.address }}
        connection={
          unlocked && connectedAccount
            ? {
                boundAddress: connectedAccount.address,
                mismatch: !sameAddress(connectedAccount.address, selected.account.address),
              }
            : null
        }
        banner={banner}
      >
        {/* The screen stays mounted (form state survives) but hidden and input-gated
            while a dApp prompt is showing. */}
        <Box display={pending ? 'none' : 'flex'} flexDirection="column" flexGrow={1}>
          <CurrentScreen
            screen={screen}
            account={selected}
            accounts={accounts}
            selectedId={selectedId}
            sendPreset={sendPreset}
            onNavigate={(s) => (s === 'send' ? goSend(null) : push(s))}
            onSend={goSend}
            onReload={onReload}
            onBack={back}
            onSelectAccount={(id) => {
              setSelectedId(id);
              back();
            }}
            onSendDone={() => {
              setSendPreset(null);
              back();
            }}
          />
        </Box>
        {pendingConnect ? (
          <ConnectPrompt
            req={pendingConnect}
            signer={{
              label: signerStored?.label,
              address: connectedAccount?.address ?? selected.account.address,
            }}
            waiting={connectQueue.length - 1 + txQueue.length}
            onResolve={resolveConnect}
          />
        ) : pendingTx ? (
          <TxPrompt req={pendingTx} waiting={txQueue.length - 1} onResolve={resolveTx} />
        ) : null}
      </AppShell>
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
  onReload,
  onBack,
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
  onReload: () => void;
  onBack: () => void;
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
      return (
        <AccountsScreen
          accounts={accounts}
          selectedId={selectedId}
          onSelect={onSelectAccount}
          onReload={onReload}
          onAddWallet={() => onNavigate('add-wallet')}
        />
      );
    case 'add-wallet':
      return (
        <OnboardingScreen
          embedded
          onDone={() => {
            onReload();
            onBack();
          }}
        />
      );
    default:
      return <DashboardScreen account={account.account} onNavigate={onNavigate} />;
  }
}
