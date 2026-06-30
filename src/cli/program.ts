import { Command } from 'commander';
import { registerBalanceCommand } from './commands/balance.js';
import { registerReceiveCommand } from './commands/receive.js';
import { registerWalletCommands } from './commands/wallet.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('tonsole')
    .description('TON terminal wallet — manage TON wallets from the command line')
    .version('0.1.0')
    .option('-n, --network <network>', 'network to use: mainnet | testnet (default: from config, testnet)')
    .option('--json', 'machine-readable JSON output')
    .showHelpAfterError();

  registerWalletCommands(program);
  registerBalanceCommand(program);
  registerReceiveCommand(program);

  return program;
}
