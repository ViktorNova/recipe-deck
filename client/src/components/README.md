# `client/src/components`

React UI, one concern per folder. Each folder owns its **`.tsx`** files and **`.module.css`** next to them (or split modules like `recipe/RecipeYamlDualEditor.*.module.css`).

| Folder | Role |
|--------|------|
| **`shell/`** | Fixed chrome and background: **Header** (title, metrics strip, theme, nav actions), **FloatingDotsBackground** (canvas behind the app). |
| **`recipe/`** | Recipe editing: **EditorPanel** (file picker, save/run, broken flag), **RecipeYamlDualEditor** (form ↔ raw YAML, mods, defaults). |
| **`runner/`** | **RunningModelPanel** — slot state, HF cache progress, run/stop/force, docker list, log stream. |
| **`metrics/`** | **LiveStatsPanel** (disk/GPU/tok/model IDs), **DbLevelMeter** (level meter for stats). |
| **`settings/`** | **ServerSettingsModal**, **AppSettingsPanel** (ports, HF token, paths, appearance), **HfTokenField**. |
| **`modals/`** | Shared dialogs: **HelpModal** (about), **ConfirmModal** (delete, force-kill, etc.). |
| **`ui/`** | Reused primitives: **ToolbarIconButton**, **GlassTooltip**, **glyphs** (inline SVG icons). |

Imports from **`App.tsx`** use explicit paths, e.g. `./components/shell/Header`.

Cross-folder imports typically go through **`ui/`** for icons and toolbar buttons; **settings/** is self-contained aside from API/types.
