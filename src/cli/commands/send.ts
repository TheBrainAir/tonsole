import chalk from 'chalk';
import type { Command } from 'commander';
import { buildApp } from '../../composition.js';
import { formatTon, parseTon } from '../../domain/amount.js';
import { AppError } from '../../engine/errors.js';
import type { TxPreview } from '../../engine/types.js';
import { promptPassphrase, readLine } from '../../secrets/passphrase.js';
import { readGlobals } from '../context.js';
import { info, printJson, success } from '../render.js';

interface SendOpts {
  comment?: string;
  from?: string;
  yes?: boolean;
}

export function registerSendCommand(program: Command): void {
  program
    .command('send')
    .description('Send TON to an address (emulated and confirmed before broadcast)')
    .argument('<to>', 'recipient address')
    .argument('<amount>', 'amount in TON, e.g. 1.5')
    .option('-c, --comment <text>', 'attach a text comment to the transfer')
    .option('--from <account>', 'sender wallet id or address (default: your default wallet)')
    .option('-y, --yes', 'skip the confirmation prompt (required when non-interactive)')
    .action(async (to: string, amount: string, opts: SendOpts, command: Command) => {
      const globals = readGlobals(command);
      const nano = parseTon(amount);
      const app = await buildApp({ network: globals.network });
      try {
        const passphrase = await promptPassphrase('Keystore passphrase: ');
        try {
          const confirm = async (preview: TxPreview): Promise<boolean> => {
            if (!globals.json) renderPreview(preview, to);
            if (opts.yes) return true;
            if (process.stdin.isTTY !== true) {
              throw new AppError('Cancelled', 'Refusing to send without --yes in a non-interactive shell.');
            }
            const answer = await readLine('Send this transaction? [y/N]: ');
            return /^y(es)?$/i.test(answer.trim());
          };

          const result = await app.transfers.sendTon({
            to,
            amount: nano,
            comment: opts.comment,
            from: opts.from,
            passphrase,
            confirm,
          });

          if (globals.json) {
            printJson({ hash: result.hash, status: result.status, explorer: result.explorerUrl });
          } else {
            success(`Sent ${chalk.bold(`${formatTon(nano)} TON`)}.`);
            if (result.explorerUrl) info(chalk.dim(result.explorerUrl));
          }
        } finally {
          passphrase.destroy();
        }
      } catch (error) {
        if (AppError.is(error, 'Cancelled')) {
          info('Cancelled — nothing was sent.');
          return;
        }
        throw error;
      } finally {
        await app.dispose();
      }
    });
}

function renderPreview(preview: TxPreview, fallbackTo: string): void {
  info();
  info(chalk.bold('Transaction preview (emulated)'));
  for (const d of preview.moneyFlow.outgoing) {
    const label = d.asset === 'TON' ? 'TON' : (d.asset.symbol ?? 'jetton');
    info(`  ${chalk.red('−')} ${formatTon(-d.amount)} ${label}  → ${chalk.dim(d.counterparty ?? fallbackTo)}`);
  }
  for (const d of preview.moneyFlow.incoming) {
    const label = d.asset === 'TON' ? 'TON' : (d.asset.symbol ?? 'jetton');
    info(`  ${chalk.green('+')} ${formatTon(d.amount)} ${label}  ${chalk.dim(`from ${d.counterparty ?? '?'}`)}`);
  }
  if (preview.moneyFlow.outgoing.length === 0 && preview.moneyFlow.incoming.length === 0) {
    info(chalk.dim('  (emulation reported no net asset movement)'));
  }
  info(chalk.dim('  plus network gas fees'));
  info();
}
