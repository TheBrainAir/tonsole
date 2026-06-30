import chalk from 'chalk';
import type { Command } from 'commander';
import type { App } from '../../composition.js';
import { buildApp } from '../../composition.js';
import { isValidAddress, parseAddress, toFriendly, toRaw } from '../../domain/address.js';
import { formatAmount, formatTon } from '../../domain/amount.js';
import type { AccountRef, HistoryItem, NetworkId } from '../../engine/types.js';
import { readGlobals } from '../context.js';
import { info, printJson } from '../render.js';

export function registerHistoryCommand(program: Command): void {
  program
    .command('history')
    .description('Show recent transactions')
    .argument('[account]', 'wallet id or address (default: your default wallet)')
    .option('-l, --limit <n>', 'number of events to fetch', '20')
    .action(async (account: string | undefined, opts: { limit: string }, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        const acct = resolveAccount(app, account);
        const limit = Number.parseInt(opts.limit, 10) || 20;
        const page = await app.history.recent(acct, { limit });

        if (globals.json) {
          printJson(page.items.map(serialize));
          return;
        }
        if (page.items.length === 0) {
          info('No transactions yet.');
          return;
        }
        for (const item of page.items) info(renderItem(item));
      } finally {
        await app.dispose();
      }
    });
}

/** A stored wallet (by id/address), or — for read-only viewing — any valid address. */
function resolveAccount(app: App, account: string | undefined): AccountRef {
  try {
    return app.accounts.resolve(account).account;
  } catch (error) {
    if (account && isValidAddress(account)) {
      return accountRefFromAddress(account, app.config.network);
    }
    throw error;
  }
}

function accountRefFromAddress(input: string, network: NetworkId): AccountRef {
  const address = parseAddress(input);
  return {
    address: toFriendly(address, { network, bounceable: false }),
    rawAddress: toRaw(address),
    workchain: address.workChain,
    version: 'v5r1',
    publicKey: '',
    network,
  };
}

function amountText(item: HistoryItem): string {
  if (item.asset === 'TON') return `${formatTon(item.amount)} TON`;
  return `${formatAmount(item.amount, item.asset.decimals)} ${item.asset.symbol ?? 'jetton'}`;
}

function renderItem(item: HistoryItem): string {
  const arrow =
    item.direction === 'out' ? chalk.red('→') : item.direction === 'in' ? chalk.green('←') : chalk.dim('↺');
  const sign = item.direction === 'out' ? '-' : item.direction === 'in' ? '+' : ' ';
  const when = new Date(item.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 16);
  const who = item.counterparty ? shorten(item.counterparty) : '';
  const note = item.comment ? chalk.dim(`  "${item.comment}"`) : '';
  const failed = item.status === 'failed' ? chalk.red(' [failed]') : '';
  return `${chalk.dim(when)}  ${arrow} ${sign}${amountText(item)}  ${chalk.dim(who)}${note}${failed}`;
}

function shorten(addr: string): string {
  return addr.length > 16 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function serialize(item: HistoryItem): Record<string, unknown> {
  return {
    hash: item.hash,
    timestamp: item.timestamp,
    direction: item.direction,
    amount: item.amount,
    asset: item.asset === 'TON' ? 'TON' : item.asset.jettonMaster,
    comment: item.comment,
    status: item.status,
  };
}
