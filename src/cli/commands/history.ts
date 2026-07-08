import chalk from 'chalk';
import type { Command } from 'commander';
import { buildApp } from '../../composition.js';
import { formatAmount, formatCoin } from '../../domain/amount.js';
import type { HistoryItem } from '../../engine/types.js';
import { readGlobals } from '../context.js';
import { info, printJson } from '../render.js';
import { resolveAccountArg } from '../resolve.js';

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
        const acct = resolveAccountArg(app, account);
        const parsed = Number.parseInt(opts.limit, 10);
        const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20;
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

function amountText(item: HistoryItem): string {
  if (item.asset === 'TON') return formatCoin(item.amount);
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
    asset: item.asset === 'TON' ? 'GRAM' : item.asset.jettonMaster,
    comment: item.comment,
    status: item.status,
  };
}
