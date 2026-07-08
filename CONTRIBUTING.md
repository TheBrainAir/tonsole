# Contributing to tonsole

Thanks for your interest in improving `tonsole`. Contributions of all kinds are welcome — bug reports, fixes,
tests, and documentation.

## Reporting bugs and requesting features

- Open a GitHub issue with clear steps to reproduce, your OS and Node.js version, and what you expected.
- **Do not report security vulnerabilities in public issues.** Follow [SECURITY.md](./SECURITY.md) instead.
- **Never** paste a real recovery phrase, passphrase, or private key into an issue, PR, log, or test. Use
  throwaway testnet wallets only.

## Development setup

Requires **Node.js ≥ 22.12**.

```bash
npm install
npm run dev         # run from source (the correct way to run during dev)
npm run typecheck   # tsc --noEmit (strict)
npm run lint        # eslint (also enforces the architecture import boundary)
npm test            # vitest
```

When testing wallet flows manually, use **testnet** (the default on first run) — never mainnet, and never
a recovery phrase that holds real funds.

## Pull requests

- Keep the architecture seam intact: `src/tui/**` and `src/cli/**` may import only `services/`, `domain/`,
  `config/`, and `shared/` — never `engine/**`, `network/**`, `secrets/Argon*`, or `@ton/*` directly. The
  linter enforces this.
- Add or update tests for behavior you change, and make sure `npm run typecheck`, `npm run lint`, and
  `npm test` all pass.
- Keep changes focused and describe the rationale in the PR.

## License and Developer Certificate of Origin (DCO)

By contributing, you agree that your contributions are licensed under the project's [MIT License](./LICENSE)
and you certify the [Developer Certificate of Origin](https://developercertificate.org/) — i.e. that you
have the right to submit the work under that license. Please sign off your commits:

```bash
git commit -s -m "your message"
```

This adds a `Signed-off-by:` line recording your certification.

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).
