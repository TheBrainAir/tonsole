import chalk from 'chalk';
import type { Command } from 'commander';
import { buildApp } from '../../composition.js';
import { formatCoin, formatTon } from '../../domain/amount.js';
import { readGlobals } from '../context.js';
import { info, printJson } from '../render.js';

export function registerBalanceCommand(program: Command): void {
  program
    .command('balance')
    .description('Show the GRAM balance of a wallet')
    .argument('[account]', 'wallet id or address (defaults to your default wallet)')
    .action(async (account: string | undefined, _opts: unknown, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        const { account: acct } = app.accounts.resolve(account);
        const balance = await app.balances.getTon(acct);
        if (globals.json) {
          printJson({
            address: acct.address,
            network: acct.network,
            amount: formatTon(balance.nano),
            nano: balance.nano,
          });
          return;
        }
        info(`${chalk.bold(formatCoin(balance.nano))}  ${chalk.dim(`on ${acct.network}`)}`);
        info(chalk.dim(acct.address));
      } finally {
        await app.dispose();
      }
    });
}
