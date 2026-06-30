import chalk from 'chalk';
import type { Command } from 'commander';
import { buildApp } from '../../composition.js';
import { formatAmount, formatTon, parseTon } from '../../domain/amount.js';
import { AppError } from '../../engine/errors.js';
import type { AssetDelta, TxPreview } from '../../engine/types.js';
import { promptPassphrase, readLine } from '../../secrets/passphrase.js';
import { readGlobals } from '../context.js';
import { info, printJson, success } from '../render.js';

interface SendOpts {
  comment?: string;
  from?: string;
  jetton?: string;
  yes?: boolean;
}

export function registerSendCommand(program: Command): void {
  program
    .command('send')
    .description('Send TON (or a jetton) to an address — emulated and confirmed first')
    .argument('<to>', 'recipient address')
    .argument('<amount>', 'amount to send, e.g. 1.5')
    .option('-c, --comment <text>', 'attach a text comment to the transfer')
    .option('--jetton <master>', 'send a jetton (by its master address) instead of TON')
    .option('--from <account>', 'sender wallet id or address (default: your default wallet)')
    .option('-y, --yes', 'skip the confirmation prompt (required when non-interactive)')
    .action(async (to: string, amount: string, opts: SendOpts, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        const passphrase = await promptPassphrase('Keystore passphrase: ');
        try {
          const confirm = makeConfirm(globals.json, opts.yes === true);
          const result = opts.jetton
            ? await app.transfers.sendJetton({
                to,
                jettonMaster: opts.jetton,
                amount,
                comment: opts.comment,
                from: opts.from,
                passphrase,
                confirm,
              })
            : await app.transfers.sendTon({
                to,
                amount: parseTon(amount),
                comment: opts.comment,
                from: opts.from,
                passphrase,
                confirm,
              });

          if (globals.json) {
            printJson({ hash: result.hash, status: result.status, explorer: result.explorerUrl });
          } else {
            success('Transaction sent.');
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

function makeConfirm(json: boolean, yes: boolean): (preview: TxPreview) => Promise<boolean> {
  return async (preview) => {
    if (!json) renderPreview(preview);
    if (yes) return true;
    if (process.stdin.isTTY !== true) {
      throw new AppError('Cancelled', 'Refusing to send without --yes in a non-interactive shell.');
    }
    const answer = await readLine('Send this transaction? [y/N]: ');
    return /^y(es)?$/i.test(answer.trim());
  };
}

function deltaText(d: AssetDelta): string {
  const abs = d.amount < 0n ? -d.amount : d.amount;
  if (d.asset === 'TON') return `${formatTon(abs)} TON`;
  return `${formatAmount(abs, d.asset.decimals)} ${d.asset.symbol ?? 'jetton'}`;
}

function renderPreview(preview: TxPreview): void {
  info();
  info(chalk.bold('Transaction preview (emulated)'));
  for (const d of preview.moneyFlow.outgoing) {
    info(`  ${chalk.red('−')} ${deltaText(d)}  → ${chalk.dim(d.counterparty ?? '?')}`);
  }
  for (const d of preview.moneyFlow.incoming) {
    info(`  ${chalk.green('+')} ${deltaText(d)}  ${chalk.dim(`from ${d.counterparty ?? '?'}`)}`);
  }
  if (preview.moneyFlow.outgoing.length === 0 && preview.moneyFlow.incoming.length === 0) {
    info(chalk.dim('  (emulation reported no net asset movement)'));
  }
  info(chalk.dim('  plus network gas fees'));
  info();
}
