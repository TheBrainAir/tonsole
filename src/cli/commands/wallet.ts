import chalk from 'chalk';
import type { Command } from 'commander';
import { buildApp } from '../../composition.js';
import { AppError } from '../../engine/errors.js';
import { promptPassphrase, readLine, readLineSecret } from '../../secrets/passphrase.js';
import { WALLET_VERSIONS, isWalletVersion, type WalletVersion } from '../../engine/types.js';
import { readGlobals } from '../context.js';
import { info, printJson, renderMnemonic, success, warn } from '../render.js';

interface ContractOpts {
  contract?: string;
  /** Deprecated shorthand for `--contract v4r2`; kept so existing scripts don't break. */
  v4?: boolean;
}

function versionFrom(opts: ContractOpts): WalletVersion {
  if (opts.contract !== undefined) {
    if (!isWalletVersion(opts.contract)) {
      throw new AppError(
        'Unknown',
        `Unknown contract "${opts.contract}" — use ${WALLET_VERSIONS.join(' or ')}.`,
      );
    }
    return opts.contract;
  }
  return opts.v4 ? 'v4r2' : 'v5r1';
}

const CONTRACT_FLAG = '--contract <version>';
const CONTRACT_DESC = 'wallet contract: v5r1 (W5, default) | v4r2';

export function registerWalletCommands(program: Command): void {
  const wallet = program.command('wallet').description('Create, import and manage wallets');

  wallet
    .command('create')
    .description('Create a new wallet and a 24-word recovery phrase')
    .option(CONTRACT_FLAG, CONTRACT_DESC)
    .option('--v4', 'deprecated alias for --contract v4r2')
    .action(async (opts: ContractOpts, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        const passphrase = await promptPassphrase('Set a keystore passphrase: ', {
          confirm: true,
          minLength: 8,
        });
        try {
          const { account, mnemonic, id } = await app.accounts.create(passphrase, {
            version: versionFrom(opts),
          });
          if (globals.json) {
            process.stderr.write(
              'tonsole: WARNING — this JSON contains your recovery phrase in plaintext; store it securely and keep it out of logs/history.\n',
            );
            printJson({
              id,
              address: account.address,
              network: account.network,
              version: account.version,
              mnemonic,
              _warning: 'This output contains your secret 24-word recovery phrase.',
            });
            return;
          }
          info();
          warn('Write these 24 words down and store them offline — they are shown ONCE and can spend your funds.');
          info();
          info(renderMnemonic(mnemonic));
          info();
          success(`Wallet created on ${chalk.bold(account.network)}: ${chalk.bold(account.address)}`);
          info(chalk.dim(`keystore id: ${id}`));
        } finally {
          passphrase.destroy();
        }
      } finally {
        await app.dispose();
      }
    });

  wallet
    .command('import')
    .description('Import a wallet from an existing 24-word recovery phrase')
    .argument('[words...]', 'the 24 words (omit — and enter them at the hidden prompt — to avoid exposing them)')
    .option(CONTRACT_FLAG, CONTRACT_DESC)
    .option('--v4', 'deprecated alias for --contract v4r2')
    .action(async (words: string[], opts: ContractOpts, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        let phrase: string;
        if (words.length > 0) {
          // argv is visible in shell history, `ps`, and /proc/<pid>/cmdline.
          process.stderr.write(
            'tonsole: WARNING — passing the recovery phrase as command arguments exposes it in your shell history and process list. Prefer `tonsole wallet import` with no words and enter it at the prompt.\n',
          );
          phrase = words.join(' ');
        } else {
          phrase = await readLineSecret('Recovery phrase (24 words): ');
        }
        const passphrase = await promptPassphrase('Set a keystore passphrase: ', {
          confirm: true,
          minLength: 8,
        });
        try {
          const { account, id } = await app.accounts.importMnemonic(phrase, passphrase, {
            version: versionFrom(opts),
          });
          if (globals.json) {
            printJson({ id, address: account.address, network: account.network, version: account.version });
            return;
          }
          success(`Wallet imported on ${chalk.bold(account.network)}: ${chalk.bold(account.address)}`);
          info(chalk.dim(`keystore id: ${id}`));
        } finally {
          passphrase.destroy();
        }
      } finally {
        await app.dispose();
      }
    });

  wallet
    .command('list')
    .alias('ls')
    .description('List your wallets')
    .action(async (_opts: unknown, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        // Every wallet, not just the active network's — a user must be able to see that
        // their other-network wallets still exist, and which ones they cannot use now.
        const accounts = app.accounts.listAll();
        const active = app.config.network;
        if (globals.json) {
          printJson(
            accounts.map((a) => ({
              id: a.id,
              address: a.account.address,
              network: a.account.network,
              version: a.account.version,
              default: a.isDefault,
              usable: a.account.network === active,
              label: a.label,
            })),
          );
          return;
        }
        if (accounts.length === 0) {
          info('No wallets yet. Create one with `tonsole wallet create`.');
          return;
        }
        for (const a of accounts) {
          const usable = a.account.network === active;
          const mark = a.isDefault ? chalk.green('*') : ' ';
          const name = a.label
            ? `${chalk.bold(a.label)} ${chalk.dim(a.account.address)}`
            : chalk.bold(a.account.address);
          const meta = `${a.account.network} ${a.account.version} · ${a.id}`;
          const note = usable ? '' : chalk.yellow(`  (not on ${active})`);
          info(`${mark} ${usable ? name : chalk.dim(name)}  ${chalk.dim(meta)}${note}`);
        }
      } finally {
        await app.dispose();
      }
    });

  wallet
    .command('use')
    .description('Set the default wallet')
    .argument('<account>', 'wallet id or address')
    .action(async (account: string, _opts: unknown, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        const chosen = app.accounts.setDefault(account);
        if (globals.json) {
          printJson({ id: chosen.id, address: chosen.account.address, default: true });
          return;
        }
        success(`Default wallet set to ${chalk.bold(chosen.account.address)}`);
      } finally {
        await app.dispose();
      }
    });

  wallet
    .command('rename')
    .description('Set or clear a wallet label')
    .argument('<account>', 'wallet id or address')
    .argument('[label]', 'new label (omit to clear)')
    .action(async (account: string, label: string | undefined, _opts: unknown, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        const a = app.accounts.rename(account, label ?? '');
        if (globals.json) printJson({ id: a.id, address: a.account.address, label: a.label });
        else success(a.label ? `Labeled ${chalk.bold(a.label)}.` : 'Label cleared.');
      } finally {
        await app.dispose();
      }
    });

  wallet
    .command('remove')
    .alias('rm')
    .description('Delete a wallet keystore (irreversible — keep your recovery phrase)')
    .argument('<account>', 'wallet id or address')
    .option('-y, --yes', 'skip the confirmation prompt')
    .action(async (account: string, opts: { yes?: boolean }, command: Command) => {
      const globals = readGlobals(command);
      const app = await buildApp({ network: globals.network });
      try {
        // Network-blind: deleting a keystore is local metadata, so it must not require
        // switching to that wallet's network first.
        const a = app.accounts.find(account);
        if (opts.yes !== true) {
          if (process.stdin.isTTY !== true) {
            throw new AppError('Cancelled', 'Refusing to remove without --yes in a non-interactive shell.');
          }
          const ans = await readLine(
            `Delete wallet ${a.label ? `"${a.label}" ` : ''}${a.account.address}? Ensure you have its recovery phrase. [y/N]: `,
          );
          if (!/^y(es)?$/i.test(ans.trim())) {
            info('Cancelled — nothing was removed.');
            return;
          }
        }
        app.accounts.remove(a.id);
        if (globals.json) printJson({ removed: a.id });
        else success('Wallet removed.');
      } catch (error) {
        if (AppError.is(error, 'Cancelled')) {
          info('Cancelled — nothing was removed.');
          return;
        }
        throw error;
      } finally {
        await app.dispose();
      }
    });
}
