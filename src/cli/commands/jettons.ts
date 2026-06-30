import chalk from 'chalk';
import type { Command } from 'commander';
import { buildApp } from '../../composition.js';
import { formatAmount } from '../../domain/amount.js';
import type { JettonBalance } from '../../engine/types.js';
import { readGlobals } from '../context.js';
import { info, printJson } from '../render.js';
import { resolveAccountArg } from '../resolve.js';

export function registerJettonsCommand(program: Command): void {
  program
    .command('jettons')
    .description('List jetton (token) balances')
    .argument('[account]', 'wallet id or address (default: your default wallet)')
    .action(async (account: string | undefined, _opts: unknown, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        const acct = resolveAccountArg(app, account);
        const jettons = await app.balances.getJettons(acct);

        if (globals.json) {
          printJson(jettons.map(serialize));
          return;
        }
        if (jettons.length === 0) {
          info('No jettons.');
          return;
        }
        for (const j of jettons) info(renderJetton(j));
      } finally {
        await app.dispose();
      }
    });
}

function renderJetton(j: JettonBalance): string {
  const amount = formatAmount(j.amount, j.decimals).padStart(16);
  const symbol = (j.symbol ?? 'jetton').padEnd(8);
  const verified = j.verified ? chalk.green('✓') : ' ';
  return `${chalk.bold(amount)} ${chalk.bold(symbol)} ${verified}  ${chalk.dim(shorten(j.master))}`;
}

function shorten(addr: string): string {
  return addr.length > 16 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function serialize(j: JettonBalance): Record<string, unknown> {
  return {
    master: j.master,
    symbol: j.symbol,
    name: j.name,
    amount: formatAmount(j.amount, j.decimals),
    raw: j.amount,
    decimals: j.decimals,
    verified: j.verified,
  };
}
