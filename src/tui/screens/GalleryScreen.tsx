import { Box, Text } from 'ink';
import { useState, type ReactNode } from 'react';
import { NETWORKS } from '../../config/networks.js';
import { formatAmount } from '../../domain/amount.js';
import type { AccountRef, JettonBalance, NftItem } from '../../engine/types.js';
import { renderImagePreview } from '../../shared/image.js';
import { copyToClipboard, openUrl } from '../../shared/system.js';
import type { App } from '../../composition.js';
import { AsyncView } from '../components/AsyncView.js';
import { ScamBadge, VerifiedBadge } from '../components/Badge.js';
import { GalleryRow, THUMB_H, THUMB_W } from '../components/GalleryRow.js';
import { ListView } from '../components/ListView.js';
import { Panel } from '../components/Panel.js';
import { Field } from '../components/ui.js';
import { useApp } from '../context.js';
import { useAsync } from '../hooks/useAsync.js';
import { useImagePreviews } from '../hooks/useImagePreviews.js';
import { useKeymap, type KeyBinding } from '../shell/keymap.js';
import { useFlash } from '../shell/StatusBar.js';
import { useViewport } from '../shell/viewport.js';
import { color } from '../theme.js';
import type { SendPreset } from './SendScreen.js';

interface GalleryAdapter<T> {
  title: string;
  loadingLabel: string;
  emptyText: string;
  emptyHint?: string;
  load(app: App, account: AccountRef): Promise<T[]>;
  image(item: T): string | undefined;
  listTitle(item: T): string;
  listSubtitle(item: T): string | undefined;
  badge(item: T): ReactNode;
  detail(item: T, network: AccountRef['network']): ReactNode;
  copy(item: T): { what: string; value: string };
  explorerAddress(item: T): string;
  sendPreset(item: T): SendPreset;
  extraBindings?(item: T, helpers: { flash: ReturnType<typeof useFlash> }): KeyBinding[];
}

/** Shared master–detail gallery (list with thumbnails + big preview panel). */
function GalleryScreen<T>({
  account,
  onSend,
  adapter,
}: {
  account: AccountRef;
  onSend: (preset: SendPreset) => void;
  adapter: GalleryAdapter<T>;
}) {
  const app = useApp();
  const viewport = useViewport();
  const flash = useFlash();
  const data = useAsync(async () => adapter.load(app, account), [account.address]);
  const items = data.data ?? [];
  const [selected, setSelected] = useState(0);
  const sel = Math.min(selected, Math.max(0, items.length - 1));
  const current = items[sel];

  const wide = viewport.breakpoint === 'wide';
  // Detail image sized to the detail panel; the url+size cache key means a
  // resize re-renders once and is then instant. In the stacked layout the image
  // shrinks with the terminal so the list keeps at least one visible row.
  const detailW = wide ? 46 : Math.min(46, viewport.contentWidth);
  const imgW = wide ? detailW - 4 : 20;
  const imgH = wide
    ? Math.max(6, Math.min(Math.floor(imgW / 2), viewport.contentRows - 12))
    : Math.max(4, Math.min(10, viewport.contentRows - 14));

  const currentImage = current !== undefined ? adapter.image(current) : undefined;
  const preview = useAsync(
    async () => (currentImage ? renderImagePreview(currentImage, { width: imgW, height: imgH }) : null),
    [currentImage, imgW, imgH],
  );
  // Prefetch thumbnails only around the selection (the visible window plus a
  // one-page lookahead) — a 200-item collection must not fire 200 fetches.
  const getThumb = useImagePreviews(
    items.slice(Math.max(0, sel - 6), sel + 7).map((item) => adapter.image(item)),
    THUMB_W,
    THUMB_H,
  );

  useKeymap(
    'screen',
    [
      { key: '↑↓', label: 'select' },
      {
        key: 's',
        label: 'send',
        onPress: () => {
          if (current !== undefined) onSend(adapter.sendPreset(current));
        },
      },
      {
        key: 'c',
        label: 'copy',
        onPress: () => {
          if (current === undefined) return;
          const { what, value } = adapter.copy(current);
          void copyToClipboard(value)
            .then(() => flash(`✓ ${what} copied`))
            .catch(() => flash('✗ could not access the clipboard', 'danger'));
        },
      },
      {
        key: 'o',
        label: 'explorer',
        onPress: () => {
          if (current === undefined) return;
          openUrl(NETWORKS[account.network].explorerAddress(adapter.explorerAddress(current)));
          flash('✓ opened in tonviewer');
        },
      },
      ...(current !== undefined ? (adapter.extraBindings?.(current, { flash }) ?? []) : []),
    ],
    { isActive: items.length > 0 },
  );
  // Refresh stays available on the empty and error states too — otherwise a
  // failed load could only be retried by leaving and re-entering the screen.
  useKeymap('screen', [
    {
      key: 'r',
      label: 'refresh',
      onPress: () => {
        setSelected(0);
        data.reload();
      },
    },
  ]);

  const title = (
    <Text bold>
      {adapter.title}{' '}
      <Text dimColor>{items.length > 0 ? `${sel + 1}/${items.length}` : ''}</Text>
    </Text>
  );

  const list = (
    <AsyncView
      state={data}
      loadingLabel={adapter.loadingLabel}
      emptyWhen={(all) => all.length === 0}
      emptyText={adapter.emptyText}
      emptyHint={adapter.emptyHint}
    >
      {() => (
        <ListView
          items={items}
          itemHeight={THUMB_H}
          selected={sel}
          onSelectionChange={setSelected}
          reservedRows={wide ? 4 : 5 + (imgH + 4)}
          onActivate={(item) => {
            openUrl(NETWORKS[account.network].explorerAddress(adapter.explorerAddress(item)));
            flash('✓ opened in tonviewer');
          }}
          renderItem={(item, { selected: isSel }) => (
            <GalleryRow
              thumb={viewport.contentWidth >= 60 ? getThumb(adapter.image(item)) : null}
              selected={isSel}
              title={adapter.listTitle(item)}
              badge={adapter.badge(item)}
              subtitle={adapter.listSubtitle(item)}
            />
          )}
        />
      )}
    </AsyncView>
  );

  const detailPanel =
    current !== undefined ? (
      <Panel
        title={
          <Text bold>
            {adapter.listTitle(current)} {adapter.badge(current)}
          </Text>
        }
      >
        <Box marginTop={1} flexDirection={wide ? 'column' : 'row'}>
          <Box
            width={imgW}
            minHeight={Math.min(imgH, 6)}
            flexShrink={0}
            flexDirection="column"
            overflowY="hidden"
          >
            {preview.loading && currentImage ? (
              <Text dimColor>rendering…</Text>
            ) : preview.data ? (
              <Text>{preview.data}</Text>
            ) : (
              <Text dimColor>(no image)</Text>
            )}
          </Box>
          <Box
            flexDirection="column"
            marginLeft={wide ? 0 : 2}
            marginTop={wide ? 1 : 0}
            flexGrow={1}
          >
            {adapter.detail(current, account.network)}
          </Box>
        </Box>
      </Panel>
    ) : null;

  if (wide) {
    return (
      <Box>
        <Panel title={title} flexGrow={1}>
          <Box marginTop={1} flexDirection="column">
            {list}
          </Box>
        </Panel>
        <Box flexDirection="column" width={detailW} flexShrink={0} marginLeft={1}>
          {detailPanel}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Panel title={title}>
        <Box marginTop={1} flexDirection="column">
          {list}
        </Box>
      </Panel>
      {detailPanel ? (
        <Box marginTop={1} flexDirection="column">
          {detailPanel}
        </Box>
      ) : null}
    </Box>
  );
}

// ── Jettons ─────────────────────────────────────────────────────────────────

const jettonAdapter: GalleryAdapter<JettonBalance> = {
  title: 'Jettons',
  loadingLabel: 'loading jettons…',
  emptyText: 'no jettons',
  emptyHint: 'tokens you receive will show up here',
  load: async (app, account) => {
    const all = await app.balances.getJettons(account);
    // Verified first, flagged scams last.
    const rank = (j: JettonBalance) =>
      j.verification === 'blacklist' ? 2 : j.verified ? 0 : 1;
    return [...all].sort((a, b) => rank(a) - rank(b));
  },
  image: (j) => j.image,
  listTitle: (j) => `${formatAmount(j.amount, j.decimals)} ${j.symbol ?? 'jetton'}`,
  listSubtitle: (j) => j.name,
  badge: (j) =>
    j.verification === 'blacklist' ? (
      <ScamBadge />
    ) : j.verified ? (
      <VerifiedBadge compact />
    ) : null,
  detail: (j) => (
    <Box flexDirection="column">
      {j.verification === 'blacklist' ? (
        <Text color={color.danger} bold>
          ⚠ TonAPI flags this token as a scam — do not interact.
        </Text>
      ) : null}
      <Field label="balance">
        {formatAmount(j.amount, j.decimals)} {j.symbol ?? ''}
      </Field>
      <Field label="decimals">{j.decimals}</Field>
      <Field label="master">
        <Text color={color.address}>{j.master}</Text>
      </Field>
      <Field label="your wallet">{j.walletAddress || '—'}</Field>
    </Box>
  ),
  copy: (j) => ({ what: 'jetton master address', value: j.master }),
  explorerAddress: (j) => j.master,
  sendPreset: (j) => ({ kind: 'jetton', master: j.master, symbol: j.symbol, decimals: j.decimals }),
};

export function JettonsScreen(props: {
  account: AccountRef;
  onSend: (preset: SendPreset) => void;
}) {
  return <GalleryScreen {...props} adapter={jettonAdapter} />;
}

// ── NFTs ────────────────────────────────────────────────────────────────────

const toHttp = (u: string) => (u.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${u.slice(7)}` : u);

const nftAdapter: GalleryAdapter<NftItem> = {
  title: 'NFTs',
  loadingLabel: 'loading NFTs…',
  emptyText: 'no NFTs yet',
  emptyHint: 'NFTs you receive will show up here',
  load: (app, account) => app.nfts.list(account),
  image: (n) => n.image,
  listTitle: (n) => n.name ?? '(unnamed)',
  listSubtitle: (n) => n.collectionName,
  badge: (n) => (n.verified ? <VerifiedBadge compact /> : null),
  detail: (n, network) => (
    <Box flexDirection="column">
      {n.collectionName ? <Field label="collection">{n.collectionName}</Field> : null}
      {n.collectionAddress ? (
        <Field label="col. address">
          <Text dimColor>{n.collectionAddress}</Text>
        </Field>
      ) : null}
      {n.index !== undefined ? <Field label="index">{n.index}</Field> : null}
      <Field label="address">
        <Text color={color.address}>{n.address}</Text>
      </Field>
      <Box marginTop={1}>
        <Text dimColor wrap="truncate-middle">
          {NETWORKS[network].explorerAddress(n.address)}
        </Text>
      </Box>
    </Box>
  ),
  copy: (n) => ({ what: 'NFT address', value: n.address }),
  explorerAddress: (n) => n.address,
  sendPreset: (n) => ({ kind: 'nft', address: n.address, name: n.name }),
  extraBindings: (n, { flash }) => [
    {
      key: 'i',
      label: 'open image',
      onPress: () => {
        if (!n.image) {
          flash('(no image url)', 'muted');
          return;
        }
        const opened = openUrl(toHttp(n.image));
        flash(
          opened ? '✓ opened the image in your browser' : '✗ image URL is not a safe http(s) link',
          opened ? 'success' : 'danger',
        );
      },
    },
  ],
};

export function NftScreen(props: { account: AccountRef; onSend: (preset: SendPreset) => void }) {
  return <GalleryScreen {...props} adapter={nftAdapter} />;
}
