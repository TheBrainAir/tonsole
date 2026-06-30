import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { NETWORKS } from '../../config/networks.js';
import type { AccountRef, NetworkId, NftItem } from '../../engine/types.js';
import { copyToClipboard, openUrl } from '../../shared/system.js';
import { Loading } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';

const WINDOW = 10;

export function NftScreen({ account }: { account: AccountRef }) {
  const app = useApp();
  const nfts = useAsync(() => app.nfts.list(account), [account.address]);
  const items = nfts.data ?? [];
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState('');

  useInput(
    (input, key) => {
      if (items.length === 0) return;
      const i = Math.min(selected, items.length - 1);
      if (key.upArrow || input === 'k') {
        setSelected(Math.max(0, i - 1));
        setStatus('');
      } else if (key.downArrow || input === 'j') {
        setSelected(Math.min(items.length - 1, i + 1));
        setStatus('');
      } else if (key.pageUp) {
        setSelected(Math.max(0, i - WINDOW));
      } else if (key.pageDown) {
        setSelected(Math.min(items.length - 1, i + WINDOW));
      } else if (input === 'c') {
        void copyToClipboard(items[i]!.address)
          .then(() => setStatus('✓ NFT address copied to clipboard'))
          .catch(() => setStatus('✗ could not access the clipboard'));
      } else if (input === 'o' || key.return) {
        openUrl(NETWORKS[account.network].explorerAddress(items[i]!.address));
        setStatus('✓ opened in your browser (tonviewer)');
      }
    },
    { isActive: items.length > 0 },
  );

  if (nfts.loading) {
    return (
      <Box flexDirection="column">
        <Text bold>NFTs</Text>
        <Loading />
      </Box>
    );
  }
  if (nfts.error) {
    return (
      <Box flexDirection="column">
        <Text bold>NFTs</Text>
        <Text color="red">{nfts.error.message}</Text>
      </Box>
    );
  }
  if (items.length === 0) {
    return (
      <Box flexDirection="column">
        <Text bold>NFTs</Text>
        <Text dimColor>no NFTs</Text>
      </Box>
    );
  }

  const sel = Math.min(selected, items.length - 1);
  const start = Math.min(Math.max(0, sel - Math.floor(WINDOW / 2)), Math.max(0, items.length - WINDOW));
  const visible = items.slice(start, start + WINDOW);
  const current = items[sel]!;

  return (
    <Box flexDirection="column">
      <Text bold>
        NFTs{' '}
        <Text dimColor>
          ({sel + 1}/{items.length})
        </Text>
      </Text>
      {start > 0 ? <Text dimColor>{`  ↑ ${start} more`}</Text> : null}
      {visible.map((nft, i) => (
        <Row key={start + i} nft={nft} selected={start + i === sel} />
      ))}
      {start + WINDOW < items.length ? (
        <Text dimColor>{`  ↓ ${items.length - start - WINDOW} more`}</Text>
      ) : null}
      <Box marginTop={1}>
        <Detail nft={current} network={account.network} />
      </Box>
      {status ? <Text color="green">{status}</Text> : null}
      <Text dimColor>
        ↑↓ navigate · c copy address · o/⏎ open in tonviewer · esc back (send via `tonsole send … --nft`)
      </Text>
    </Box>
  );
}

function Row({ nft, selected }: { nft: NftItem; selected: boolean }) {
  const name = nft.name ?? '(unnamed)';
  const verified = nft.verified ? ' ✓' : '';
  return (
    <Text color={selected ? 'cyan' : undefined}>{`${selected ? '❯' : ' '} ${name}${verified}`}</Text>
  );
}

function Detail({ nft, network }: { nft: NftItem; network: NetworkId }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text>
        {nft.name ?? '(unnamed)'} {nft.verified ? <Text color="green">✓</Text> : null}
      </Text>
      {nft.collectionName ? <Text dimColor>collection: {nft.collectionName}</Text> : null}
      <Text dimColor>address: {nft.address}</Text>
      <Text dimColor>{NETWORKS[network].explorerAddress(nft.address)}</Text>
    </Box>
  );
}
