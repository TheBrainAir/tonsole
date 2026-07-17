import chalk from 'chalk';
import type { Command } from 'commander';
import { configFileNetwork, envNetwork, loadConfig, saveConfigPatch } from '../../config/config.js';
import { NETWORK_IDS, NETWORKS, parseNetworkId } from '../../config/networks.js';
import type { NetworkId } from '../../engine/types.js';
import { walletCountsByNetwork } from '../../services/AccountService.js';
import { readGlobals } from '../context.js';
import { info, printJson, success, warn } from '../render.js';

/** Where the active network came from — what the user must change to change it. */
type NetworkSource = 'flag' | 'env' | 'config' | 'default';

function sourceOf(flag: NetworkId | undefined): NetworkSource {
  if (flag) return 'flag';
  if (envNetwork()) return 'env';
  if (configFileNetwork()) return 'config';
  return 'default';
}

/**
 * `network` deliberately does NOT build the app: `buildApp` constructs an engine, and
 * a network whose endpoint is unreachable makes that throw — leaving the user unable
 * to run the very command that would switch them away from it. Config + keystore
 * metadata is all this needs.
 */
export function registerNetworkCommand(program: Command): void {
  const network = program
    .command('network')
    .description('Show or switch the active network (mainnet | testnet)');

  network.action((_opts: unknown, command: Command) => {
    const globals = readGlobals(command);
    const active = globals.network ?? loadConfig().network;
    const source = sourceOf(globals.network);
    const counts = walletCountsByNetwork();

    if (globals.json) {
      printJson({
        active,
        source,
        saved: configFileNetwork(),
        networks: NETWORK_IDS.map((id) => ({
          id,
          active: id === active,
          wallets: counts[id],
          // URLs only — resolveApi() also carries API keys, which must not be printed.
          toncenter: NETWORKS[id].toncenterUrl,
          tonapi: NETWORKS[id].tonapiUrl,
        })),
      });
      return;
    }

    for (const id of NETWORK_IDS) {
      const mark = id === active ? chalk.green('*') : ' ';
      const name = id === active ? chalk.bold(id) : id;
      info(`${mark} ${name.padEnd(16)} ${chalk.dim(`${counts[id]} wallet(s) · ${NETWORKS[id].tonapiUrl}`)}`);
    }
    info();
    info(chalk.dim(explainSource(active, source)));
  });

  network
    .command('use')
    .description('Set the active network and save it')
    .argument('<network>', 'mainnet | testnet')
    .action((value: string, _opts: unknown, command: Command) => {
      const globals = readGlobals(command);
      const next = parseNetworkId(value);
      saveConfigPatch({ network: next });

      // The env var wins over config.json in loadConfig(), so a save can be real and
      // still have no effect. Say so rather than reporting a switch that didn't happen.
      const effective = loadConfig().network;
      const shadowed = effective !== next ? envNetwork() : undefined;
      const counts = walletCountsByNetwork();

      if (globals.json) {
        printJson({ saved: next, active: effective, shadowedBy: shadowed ? 'TONSOLE_NETWORK' : null });
      } else {
        success(`Network set to ${chalk.bold(next)}`);
        if (shadowed) {
          warn(
            `TONSOLE_NETWORK=${shadowed} overrides your saved default — unset it for this to take effect.`,
          );
        } else if (counts[next] === 0) {
          info(
            chalk.dim(
              `No ${next} wallets yet — wallets are per-network. Create or import one with \`tonsole wallet create\`.`,
            ),
          );
        }
      }
    });
}

function explainSource(active: NetworkId, source: NetworkSource): string {
  switch (source) {
    case 'flag':
      return `Active: ${active} (from --network, this command only).`;
    case 'env':
      return `Active: ${active} (from TONSOLE_NETWORK; it overrides the saved default).`;
    case 'config':
      return `Active: ${active} (saved). Change it with \`tonsole network use <network>\`.`;
    case 'default':
      return `Active: ${active} (default). Change it with \`tonsole network use <network>\`.`;
  }
}
