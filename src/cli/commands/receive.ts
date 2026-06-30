import chalk from 'chalk';
import type { Command } from 'commander';
import { buildApp } from '../../composition.js';
import { readGlobals } from '../context.js';
import { info, printJson } from '../render.js';

export function registerReceiveCommand(program: Command): void {
  program
    .command('receive')
    .description('Show an address (with QR) to receive funds')
    .argument('[account]', 'wallet id or address (defaults to your default wallet)')
    .option('--no-qr', 'do not render the QR code')
    .action(async (account: string | undefined, opts: { qr?: boolean }, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        const { account: acct } = app.accounts.resolve(account);
        const explorer = app.receive.explorerUrl(acct.address);
        if (globals.json) {
          printJson({ address: acct.address, network: acct.network, explorer });
          return;
        }
        info(chalk.bold(acct.address));
        info(chalk.dim(explorer));
        if (opts.qr !== false) {
          info();
          info(await app.receive.qr(acct.address));
        }
      } finally {
        await app.dispose();
      }
    });
}
