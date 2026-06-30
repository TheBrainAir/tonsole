import chalk from 'chalk';
import type { Command } from 'commander';
import { buildApp } from '../../composition.js';
import type { NftItem } from '../../engine/types.js';
import { readGlobals } from '../context.js';
import { info, printJson } from '../render.js';
import { resolveAccountArg } from '../resolve.js';

export function registerNftCommand(program: Command): void {
  program
    .command('nft')
    .description('List NFTs held by a wallet')
    .argument('[account]', 'wallet id or address (defaults to your default wallet)')
    .action(async (account: string | undefined, _opts: unknown, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        const acct = resolveAccountArg(app, account);
        const nfts = await app.nfts.list(acct);

        if (globals.json) {
          printJson(nfts.map(serialize));
          return;
        }
        if (nfts.length === 0) {
          info('No NFTs.');
          return;
        }
        for (const n of nfts) info(renderNft(n));
        info(chalk.dim('\nSend one with: tonsole send <to> --nft <nft-address>'));
      } finally {
        await app.dispose();
      }
    });
}

function renderNft(n: NftItem): string {
  const name = n.name ?? '(unnamed)';
  const collection = n.collectionName ? chalk.dim(` · ${n.collectionName}`) : '';
  const verified = n.verified ? chalk.green(' ✓') : '';
  return `${chalk.bold(name)}${collection}${verified}  ${chalk.dim(n.address)}`;
}

function serialize(n: NftItem): Record<string, unknown> {
  return {
    address: n.address,
    name: n.name,
    collection: n.collectionName,
    collectionAddress: n.collectionAddress,
    verified: n.verified,
    image: n.image,
  };
}
