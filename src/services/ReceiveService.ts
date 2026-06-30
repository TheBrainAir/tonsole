import qrcode from 'qrcode-terminal';
import { NETWORKS } from '../config/networks.js';
import type { Config } from '../config/schema.js';

/** Receive view: the address to share, an explorer link, and a terminal QR code. */
export class ReceiveService {
  constructor(private readonly config: Config) {}

  explorerUrl(address: string): string {
    return NETWORKS[this.config.network].explorerAddress(address);
  }

  /** Render a scannable QR for the address (small = compact half-block style). */
  qr(text: string, opts?: { small?: boolean }): Promise<string> {
    return new Promise((resolve) => {
      qrcode.generate(text, { small: opts?.small ?? true }, (rendered) => resolve(rendered));
    });
  }
}
