# Security Policy

`tonsole` is a self-custodial wallet. Security reports are taken seriously — thank you for helping keep
users safe.

## Supported versions

`tonsole` is pre-1.0 and under active development. Only the **latest released version** (and `main`) is
supported with security fixes. There is no support for older versions.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.** Disclose them privately so a fix can be
prepared before details are public:

- Preferred: open a private **GitHub Security Advisory** on this repository
  (Security → Advisories → *Report a vulnerability*).
- Alternatively, email the maintainers at **hello@lotumi.com**.

Please include: the affected version/commit, a description of the issue and its impact, and — where
possible — reproduction steps or a proof of concept. Do **not** include any real recovery phrase,
passphrase, or private key in your report.

## What to expect

- We aim to acknowledge a valid report within a few days and to keep you updated on remediation.
- This is a volunteer, best-effort open-source project: response times are not guaranteed and there is
  **no bug-bounty program** or monetary reward.
- We will credit reporters who wish to be acknowledged once a fix is released, unless you prefer to remain
  anonymous.

## Scope

In scope: the `tonsole` source in this repository (keystore/crypto, the send/emulation pipeline, TON Connect
handling, input sanitization, and CLI/TUI behavior). Out of scope: vulnerabilities in third-party
dependencies or services (report those upstream), and issues that require a compromised local machine or
physical access, which are outside this hot wallet's threat model.
