import { spawn } from 'node:child_process';
import clipboard from 'clipboardy';

/** Copy text to the system clipboard. */
export async function copyToClipboard(text: string): Promise<void> {
  await clipboard.write(text);
}

/** Open a URL in the OS default browser (fire-and-forget, cross-platform). */
export function openUrl(url: string): void {
  if (process.platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
  } else if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
  } else {
    spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
  }
}
