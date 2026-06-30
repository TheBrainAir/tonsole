import { Box, Text, useApp as useInkApp, useInput } from 'ink';
import { useMemo, useState } from 'react';
import type { App } from '../composition.js';
import type { StoredAccount } from '../services/AccountService.js';
import { AppProvider, useApp } from './context.js';
import { AccountsScreen } from './screens/AccountsScreen.js';
import { ConnectScreen } from './screens/ConnectScreen.js';
import { DashboardScreen } from './screens/DashboardScreen.js';
import { HistoryScreen } from './screens/HistoryScreen.js';
import { JettonsScreen } from './screens/JettonsScreen.js';
import { OnboardingScreen } from './screens/OnboardingScreen.js';
import { ReceiveScreen } from './screens/ReceiveScreen.js';
import { SendScreen } from './screens/SendScreen.js';

export type Screen =
  | 'dashboard'
  | 'send'
  | 'receive'
  | 'history'
  | 'jettons'
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
  const { exit } = useInkApp();
  const [selectedId, setSelectedId] = useState(
    accounts.find((a) => a.isDefault)?.id ?? accounts[0]!.id,
  );
  const [stack, setStack] = useState<Screen[]>(['dashboard']);
  const selected = accounts.find((a) => a.id === selectedId) ?? accounts[0]!;
  const screen = stack[stack.length - 1]!;

  const push = (s: Screen) => setStack((st) => [...st, s]);
  const back = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));

  useInput((input, key) => {
    if (key.escape && stack.length > 1) back();
    else if (input === 'q' && stack.length === 1) exit();
  });

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header account={selected} />
      <Box marginTop={1} flexDirection="column">
        {screen === 'dashboard' && (
          <DashboardScreen
            account={selected.account}
            onNavigate={push}
            multipleAccounts={accounts.length > 1}
          />
        )}
        {screen === 'send' && <SendScreen account={selected.account} onDone={back} />}
        {screen === 'receive' && <ReceiveScreen account={selected.account} />}
        {screen === 'history' && <HistoryScreen account={selected.account} />}
        {screen === 'jettons' && <JettonsScreen account={selected.account} />}
        {screen === 'connect' && <ConnectScreen account={selected.account} />}
        {screen === 'accounts' && (
          <AccountsScreen
            accounts={accounts}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              back();
            }}
          />
        )}
      </Box>
      <Footer atRoot={stack.length === 1} />
    </Box>
  );
}

function Header({ account }: { account: StoredAccount }) {
  return (
    <Box justifyContent="space-between">
      <Text>
        <Text bold color="cyan">
          tonsole
        </Text>
        <Text dimColor> · {account.account.network}</Text>
      </Text>
      <Text color="yellow">{account.account.address}</Text>
    </Box>
  );
}

function Footer({ atRoot }: { atRoot: boolean }) {
  return (
    <Box marginTop={1}>
      <Text dimColor>{atRoot ? '↑↓ move · ⏎ select · q quit' : 'esc back'}</Text>
    </Box>
  );
}
