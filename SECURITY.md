# Security

## Supported versions

Security fixes are applied on the default branch (`main`). Use the latest tag or commit for production.

## Reporting a vulnerability

Please report security issues **privately** (do not open a public issue with exploit details). If this repository is hosted on a forge that supports private security advisories, use that channel; otherwise contact the maintainers through whatever private channel the project lists.

## Secrets and configuration

- **Never commit** real API keys, Hugging Face tokens, passwords, or operator-specific SSH hosts. Use **`.env`** (see `.env.example`) and gitignored **`operator.local.env`** for deploy identities (see `docs/OPERATOR-LOCAL.md`).
- Recipe Deck has **no built-in authentication** by default. Bind to loopback (`SWITCHER_HOST=127.0.0.1`) or protect the service with a firewall, VPN, or reverse proxy with auth if exposed beyond a trusted network.

## If a secret was committed

Rotate the credential immediately, remove it from git history (e.g. `git filter-repo` or forge support tools), and treat the secret as compromised.
