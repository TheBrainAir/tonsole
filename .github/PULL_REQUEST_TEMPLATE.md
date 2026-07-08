## What this changes

<!-- Summary of the change and why it's needed. Link related issues: Fixes #123 -->

## How it was tested

<!-- `npm test`? Manual run on testnet? TUI screenshots welcome. -->

## Checklist

- [ ] `npm run lint && npm run typecheck && npm test` pass
- [ ] The architecture seam is intact (`src/tui/**`/`src/cli/**` import only `services/`, `domain/`, `config/`, `shared/`)
- [ ] No secrets (recovery phrases, keys, API tokens) in code, tests, or fixtures
- [ ] Commits are signed off (DCO, `git commit -s`) — see [CONTRIBUTING.md](../CONTRIBUTING.md)
