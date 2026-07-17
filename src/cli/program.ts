import { Command } from 'commander';
import { VERSION } from '../version.js';
import { registerBalanceCommand } from './commands/balance.js';
import { registerHistoryCommand } from './commands/history.js';
import { registerJettonsCommand } from './commands/jettons.js';
import { registerNetworkCommand } from './commands/network.js';
import { registerNftCommand } from './commands/nft.js';
import { registerReceiveCommand } from './commands/receive.js';
import { registerSendCommand } from './commands/send.js';
import { registerWalletCommands } from './commands/wallet.js';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('tonsole')
    .description('TON terminal wallet — manage TON wallets from the command line')
    .version(VERSION)
    .option('-n, --network <network>', 'network to use: mainnet | testnet (default: from config, testnet)')
    .option('--json', 'machine-readable JSON output')
    .showHelpAfterError();

  registerWalletCommands(program);
  registerNetworkCommand(program);
  registerBalanceCommand(program);
  registerSendCommand(program);
  registerReceiveCommand(program);
  registerJettonsCommand(program);
  registerNftCommand(program);
  registerHistoryCommand(program);

  return program;
}
