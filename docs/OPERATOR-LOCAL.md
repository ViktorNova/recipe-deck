# Operator-local identifiers

Personal or site-specific values (SSH user, hostnames, git URLs, home-directory paths) belong in **`operator.local.env`** at the repo root. That file is **gitignored** so it is never committed.

## First-time setup

1. Copy the template:

   ```bash
   cp operator.local.env.example operator.local.env
   ```

2. Edit **`operator.local.env`** and set at least **`DEPLOY_SSH`** to a value appropriate for **your** environment, for example `operator@your-inference-host.example`. See **`operator.local.env.example`** for the full set of variables.

3. Optionally set **`DEPLOY_REMOTE_PATH`** (default `repos/recipe-deck`, meaning `$HOME/repos/recipe-deck` on the **remote** host). Use a **relative** segment like `repos/recipe-deck` or an **absolute** remote path — do **not** use `~` in this file, because sourcing would expand tilde to the **deploy machine’s** home, not the target host’s.

4. **`scripts/deploy-gb10.sh`** automatically sources **`operator.local.env`** when present. You can still override for a single run:

   ```bash
   DEPLOY_HOST=user@other-host.example ./scripts/deploy-gb10.sh
   ```

   The historical name **`scripts/deploy-gx10.sh`** is a thin alias that runs **`deploy-gb10.sh`**.

## Finding this from runbooks or search

- **Template (tracked):** `operator.local.env.example`
- **Live values (untracked):** `operator.local.env`
- **App runtime config (untracked):** `.env` (from `.env.example`) — different file; holds `SPARK_VLLM_ROOT`, ports, etc.

Keywords: **deploy**, **gb10**, **DEPLOY_SSH**, **operator.local**.
