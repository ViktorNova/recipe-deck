# Recipe Deck — UI conventions

Operator-facing notes for **layout, theming, and DRY** in the React client. For data flow and server layout, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Stack

- **React 19** + **Vite 6**, **CSS Modules** per component (`*.module.css`).
- **No** inline styles for layout/theme; shared design tokens live in **`client/src/styles/tokens.css`** (imported via **`client/src/styles/global.css`**).

## Component folders

- UI code is grouped under **`client/src/components/`** by role — **`shell/`** (header + dots), **`recipe/`** (editor), **`runner/`**, **`metrics/`**, **`settings/`**, **`modals/`**, **`ui/`** (shared primitives). See **`client/src/components/README.md`**.

## CSS module files (avoid monoliths)

- Prefer **several small `*.module.css` files** over one huge sheet. Split by **layout region** or **concern** (e.g. `styles/app/appLayout.module.css`, `appHeaderAurora.module.css`, `appHealthyCarousel.module.css` for `App.tsx`).
- **Merge** in the component when class names stay the same: `const styles = { ...a, ...b };` — then `styles.className` is unchanged in JSX.
- **Do not split** when rules are tightly coupled:
  - **`composes:`** in CSS Modules (both classes must live in the **same** file, e.g. `EditorPanel` / `RunningModelPanel`).
  - **Nested selectors** that reference two local classes in one rule (e.g. `.dockerToggleRow .runningToggle`) — keep those classes in the **same** module.
  - **`@media` blocks** that set two different local classes must be in the file that **defines** those classes (each class gets its own hash per file).

## Design tokens

- Colors, radii, spacing, glass surfaces (`--glass-panel-bg`, `--glass-blur`, `--glass-panel-shadow`, etc.) are **CSS variables** on `:root` / `[data-theme="dark"]`.
- **Theme:** `document.documentElement` uses `data-theme="light"` or `data-theme="dark"` (user preference + Settings where relevant).

## Panels and modals

- Main content uses **frosted glass** panels: `background: var(--glass-panel-bg)`, `backdrop-filter: var(--glass-blur)`, border from `--color-border`, **`box-shadow: var(--glass-panel-shadow)`** — same language for **Editor**, **Running Model**, **Live stats**, and **modal cards** (Help, confirm, server settings).
- **Buttons** that sit on glass often use `color-mix` with `--color-accent` and `--glass-panel-bg` for hover (see `ToolbarIconButton`, modal footers).

## Background canvas

- **`FloatingDotsBackground`** (`pointer-events: none`) draws behind the UI.
- Connector lines point at a **focal point** that follows the pointer while it is over the document; when there is no tracked pointer (mouse left the window, touch lifted, etc.), the focal point **drifts** smoothly unless **`prefers-reduced-motion: reduce`** (then a static center is used).
- **Simple UI** (Settings) disables the animated dots and header aurora for a calmer surface.

## TypeScript and DRY

- **Upstream repo URL** for links and About copy: import **`SPARK_VLLM_DOCKER_REPO_URL`** from **`client/src/constants/upstream.ts`** (same as [`spark-vllm-docker` on GitHub](https://github.com/eugr/spark-vllm-docker)) — do not duplicate the URL string in components.
- **API** calls: centralize in **`client/src/api/client.ts`**.

## Lint and format

- Run **`npm run typecheck`** and **`npm run lint`** before submitting changes.
- Use **`npm run format`** (Prettier) for TS/CSS when you touch style-heavy files.

See also [CONTRIBUTING.md](../CONTRIBUTING.md).
