# Contributing

- Open issues or pull requests against the default branch.
- Run **`npm run typecheck`** and **`npm run lint`** before submitting changes.
- Use **`npm run format`** (Prettier) for TS/CSS if you change style; keep diffs focused.
- Match existing formatting and patterns in the touched files. For UI work, read **[docs/UI.md](docs/UI.md)** (tokens, CSS Modules, DRY links) and **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** (data flow).
- Do not commit **`.env`**, **`operator.local.env`**, or real tokens; use `.env.example` and `operator.local.env.example` as templates only.

By contributing, you agree that your contributions are licensed under the same license as this project (see `LICENSE`).
