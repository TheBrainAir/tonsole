import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { NETWORKS } from '../../config/networks.js';
import type { AccountRef, NetworkId, NftItem } from '../../engine/types.js';
import { renderImagePreview } from '../../shared/image.js';
import { copyToClipboard, openUrl } from '../../shared/system.js';
import { GalleryRow, THUMB_H, THUMB_W } from '../components/GalleryRow.js';
import { Loading } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';
import { useImagePreviews } from '../hooks/useImagePreviews.js';
import type { SendPreset } from './SendScreen.js';

const WINDOW = 4;
const IMG_W = 20;
const IMG_H = 10;

const toHttp = (u: string) => (u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7)}` : u);

export function NftScreen({
  account,
  onSend,
}: {
  account: AccountRef;
  onSend: (preset: SendPreset) => void;
}) {
  const app = useApp();
  const nfts = useAsync(() => app.nfts.list(account), [account.address]);
  const items = nfts.data ?? [];
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState('');

  const sel = items.length > 0 ? Math.min(selected, items.length - 1) : 0;
  const current = items[sel];
  const start = Math.min(Math.max(0, sel - Math.floor(WINDOW / 2)), Math.max(0, items.length - WINDOW));
  const visible = items.slice(start, start + WINDOW);

  const preview = useAsync(
    () => (current?.image ? renderImagePreview(current.image, { width: IMG_W, height: IMG_H }) : Promise.resolve(null)),
    [current?.image],
  );
  const getThumb = useImagePreviews(
    visible.map((n) => n.image),
    THUMB_W,
    THUMB_H,
  );

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
          .then(() => setStatus('✓ NFT address copied'))
          .catch(() => setStatus('✗ could not access the clipboard'));
      } else if (input === 'i' && items[i]!.image) {
        openUrl(toHttp(items[i]!.image!));
        setStatus('✓ opened the image in your browser');
      } else if (input === 's') {
        onSend({ kind: 'nft', address: items[i]!.address, name: items[i]!.name });
      } else if (input === 'o' || key.return) {
        openUrl(NETWORKS[account.network].explorerAddress(items[i]!.address));
        setStatus('✓ opened in tonviewer');
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
  if (items.length === 0 || !current) {
    return (
      <Box flexDirection="column">
        <Text bold>NFTs</Text>
        <Text dimColor>no NFTs</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>
        NFTs{' '}
        <Text dimColor>
          ({sel + 1}/{items.length})
        </Text>
      </Text>
      {start > 0 ? <Text dimColor>{`  ↑ ${start} more`}</Text> : null}
      {visible.map((nft, idx) => (
        <GalleryRow
          key={start + idx}
          thumb={getThumb(nft.image)}
          selected={start + idx === sel}
          title={`${nft.name ?? '(unnamed)'}${nft.verified ? ' ✓' : ''}`}
          subtitle={nft.collectionName}
        />
      ))}
      {start + WINDOW < items.length ? (
        <Text dimColor>{`  ↓ ${items.length - start - WINDOW} more`}</Text>
      ) : null}

      <Box marginTop={1} borderStyle="round" borderColor="gray" paddingX={1}>
        <Box width={IMG_W} minHeight={IMG_H} flexShrink={0} flexDirection="column">
          {preview.loading ? (
            <Text dimColor>rendering…</Text>
          ) : preview.data ? (
            <Text>{preview.data}</Text>
          ) : (
            <Text dimColor>{current.image ? '(no preview — press i)' : '(no image)'}</Text>
          )}
        </Box>
        <Box marginLeft={2} flexDirection="column">
          <NftMeta nft={current} network={account.network} />
        </Box>
      </Box>

      {status ? <Text color="green">{status}</Text> : null}
      <Text dimColor>↑↓ navigate · s send · i open image · o tonviewer · c copy address · esc back</Text>
    </Box>
  );
}

function NftMeta({ nft, network }: { nft: NftItem; network: NetworkId }) {
  return (
    <Box flexDirection="column">
      <Text bold>
        {nft.name ?? '(unnamed)'} {nft.verified ? <Text color="green">✓</Text> : null}
      </Text>
      {nft.collectionName ? <Text dimColor>{nft.collectionName}</Text> : null}
      {nft.index ? <Text dimColor>index: {nft.index}</Text> : null}
      <Box marginTop={1}>
        <Text color="yellow">{nft.address}</Text>
      </Box>
      <Text dimColor>{NETWORKS[network].explorerAddress(nft.address)}</Text>
    </Box>
  );
}
