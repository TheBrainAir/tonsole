import { Box, Text } from 'ink';
import type { StoredAccount } from '../../services/AccountService.js';
import { SelectList, type SelectItem } from '../components/SelectList.js';

export function AccountsScreen({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: StoredAccount[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const items: SelectItem<string>[] = accounts.map((a) => ({
    label: `${a.id === selectedId ? '● ' : '  '}${a.account.address}`,
    value: a.id,
    hint: `${a.account.network} ${a.account.version}`,
  }));
  return (
    <Box flexDirection="column">
      <Text bold>Accounts</Text>
      <Box marginTop={1}>
        <SelectList items={items} onSelect={onSelect} />
      </Box>
    </Box>
  );
}
