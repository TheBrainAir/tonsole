import chalk from 'chalk';
import type { Command } from 'commander';
import { buildApp } from '../../composition.js';
import { formatAmount, formatCoin, formatTon, parseTon } from '../../domain/amount.js';
import { AppError } from '../../engine/errors.js';
import type { AssetDelta, TxPreview } from '../../engine/types.js';
import { promptPassphrase, readLine } from '../../secrets/passphrase.js';
import { readGlobals } from '../context.js';
import { info, printJson, success } from '../render.js';

interface SendOpts {
  comment?: string;
  from?: string;
  jetton?: string;
  nft?: string;
  yes?: boolean;
}

function requireAmount(amount: string | undefined): string {
  if (amount === undefined) {
    throw new AppError('InvalidAmount', 'An amount is required (omit it only with --nft).');
  }
  return amount;
}

export function registerSendCommand(program: Command): void {
  program
    .command('send')
    .description('Send GRAM, a jetton, or an NFT to an address — emulated and confirmed first')
    .argument('<to>', 'recipient address or .ton name')
    .argument('[amount]', 'amount for GRAM/jetton, or "max" to send all GRAM (omit for --nft)')
    .option('-c, --comment <text>', 'attach a text comment to the transfer')
    .option('--jetton <master>', 'send a jetton (by its master address) instead of GRAM')
    .option('--nft <address>', 'send an NFT (by its item address) instead of GRAM')
    .option('--from <account>', 'sender wallet id or address (default: your default wallet)')
    .option('-y, --yes', 'skip the confirmation prompt (required when non-interactive)')
    .action(async (to: string, amount: string | undefined, opts: SendOpts, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        const passphrase = await promptPassphrase('Keystore passphrase: ');
        try {
          const confirm = makeConfirm(globals.json, opts.yes === true);
          const result = opts.nft
            ? await app.transfers.sendNft({
                to,
                nftAddress: opts.nft,
                comment: opts.comment,
                from: opts.from,
                passphrase,
                confirm,
              })
            : opts.jetton
              ? await app.transfers.sendJetton({
                  to,
                  jettonMaster: opts.jetton,
                  amount: requireAmount(amount),
                  comment: opts.comment,
                  from: opts.from,
                  passphrase,
                  confirm,
                })
              : /^(max|all)$/i.test((amount ?? '').trim())
                ? await app.transfers.sendTon({
                    to,
                    sendMax: true,
                    comment: opts.comment,
                    from: opts.from,
                    passphrase,
                    confirm,
                  })
                : await app.transfers.sendTon({
                    to,
                    amount: parseTon(requireAmount(amount)),
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
  if (d.assetType === 'nft') return 'an NFT';
  const abs = d.amount < 0n ? -d.amount : d.amount;
  if (d.asset === 'TON') return formatCoin(abs);
  return `${formatAmount(abs, d.asset.decimals)} ${d.asset.symbol ?? 'tokens'}`;
}

function who(d: AssetDelta): string {
  return d.counterpartyName ?? d.counterparty ?? '?';
}

function renderPreview(preview: TxPreview): void {
  info();
  info(
    preview.ok
      ? chalk.green.bold('✓ If you sign, this happens:')
      : chalk.red.bold('✗ This would FAIL — nothing will be sent'),
  );
  for (const d of preview.moneyFlow.outgoing) {
    info(`  ${chalk.red('−')} ${deltaText(d)}  → ${chalk.dim(who(d))}`);
  }
  for (const d of preview.moneyFlow.incoming) {
    info(`  ${chalk.green('+')} ${deltaText(d)}  ${chalk.dim(`from ${who(d)}`)}`);
  }
  if (preview.moneyFlow.outgoing.length === 0 && preview.moneyFlow.incoming.length === 0) {
    info(chalk.dim('  (no net asset movement — likely a contract call)'));
  }
  const fee = preview.estimatedFees?.total;
  info(chalk.dim(`  network fee ${fee !== undefined ? `≈ ${formatTon(fee)} GRAM` : '— a few mGRAM'}`));
  const tonOut = preview.moneyFlow.outgoing
    .filter((d) => d.asset === 'TON')
    .reduce((s, d) => s + (d.amount < 0n ? -d.amount : d.amount), 0n);
  if (tonOut > 0n && fee !== undefined) {
    info(chalk.dim(`  total leaving ≈ ${formatTon(tonOut + fee)} GRAM`));
  }
  for (const w of preview.warnings) info(chalk.yellow(`  ⚠ ${w}`));
  info();
}
