import YAML from "yaml";
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { fetchDockerImageOptions, postRecipeModsStatus } from "../../api/client.js";
import {
  buildArgsToLines,
  DEFAULTS_STRUCTURED_KEYS,
  defaultsToYamlRest,
  envToLines,
  getDefaultsObject,
  linesToBuildArgs,
  linesToEnv,
  linesToMods,
  parseDefaultsYaml,
  safeParseYaml,
  stringifyRecipe,
} from "../../lib/sparkRecipeYaml.js";
import { IconRefresh } from "../ui/glyphs.js";
import { ToolbarIconButton } from "../ui/ToolbarIconButton.js";
import recipeYamlShell from "./RecipeYamlDualEditor.shell.module.css";
import recipeYamlForm from "./RecipeYamlDualEditor.form.module.css";

const styles = { ...recipeYamlShell, ...recipeYamlForm };

/** One row per mod line + trailing empty row for “add another”. */
function initModLinesFromDoc(mods: unknown): string[] {
  if (!Array.isArray(mods) || mods.length === 0) {
    return [""];
  }
  return [...mods.map(String), ""];
}

const RAW_MODE_TOOLTIP =
  "Apply validates YAML and updates the form. Switch to form requires valid YAML. Comments and formatting may change when round-tripping through the form.";

const FORM_MODE_TOOLTIP =
  "Top-level keys you do not edit here stay on the document (e.g. recipe_deck). Comments and key order may change when the file is saved (YAML round-trip). Use Raw YAML for full control or uncommon keys.";

/** Strip trailing ` · v…` suffix we add when syncing display name to recipe_version. */
const RECIPE_NAME_VERSION_SUFFIX = /\s*·\s*v[\w.+-]+$/i;

function stripRecipeVersionSuffix(name: string): string {
  return name.replace(RECIPE_NAME_VERSION_SUFFIX, "").trimEnd();
}

/** vLLM `--max-model-len` style lengths (discrete presets; unknown values get an extra option). */
const MAX_MODEL_LEN_OPTIONS = [
  2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144,
] as const;
/** Common `max_num_batched_tokens` presets for scheduler batching. */
const MAX_NUM_BATCHED_TOKENS_OPTIONS = [
  2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144,
] as const;

function optionsWithCurrent(presets: readonly number[], current: number | undefined): number[] {
  if (current == null || !Number.isFinite(current)) {
    return [...presets];
  }
  const n = Math.round(current);
  if (presets.includes(n)) {
    return [...presets];
  }
  return [...presets, n].sort((a, b) => a - b);
}

function getNumericDefault(def: Record<string, unknown>, key: string): number | undefined {
  const v = def[key];
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return undefined;
}

function getStr(d: Record<string, unknown>, k: string): string {
  const v = d[k];
  if (v === undefined || v === null) {
    return "";
  }
  return String(v);
}

function getBool(d: Record<string, unknown>, k: string): boolean {
  return Boolean(d[k]);
}

export interface RecipeYamlDualEditorProps {
  content: string;
  onContentChange: (value: string) => void;
  disabled?: boolean;
  /** When true (and form mode), each mods line is checked on the server under $SPARK_VLLM_ROOT/mods */
  modsValidationEnabled?: boolean;
}

/**
 * Form vs raw YAML editor (pattern from llama-cpp-recipe-deck: segmented toggle, raw apply/reset).
 * Form maps common spark-vllm `run-recipe.py` recipe fields; unknown keys stay in the document.
 */
export function RecipeYamlDualEditor(props: RecipeYamlDualEditorProps): ReactElement {
  const { content, onContentChange, disabled, modsValidationEnabled = true } = props;

  const [rawMode, setRawMode] = useState(true);
  const [formDoc, setFormDoc] = useState<Record<string, unknown>>(() => safeParseYaml(content));
  const [rawDraft, setRawDraft] = useState(content);
  const [rawError, setRawError] = useState("");
  const [defaultsError, setDefaultsError] = useState("");
  const [modLines, setModLines] = useState<string[]>(() => initModLinesFromDoc(safeParseYaml(content).mods));
  const [modsExists, setModsExists] = useState<boolean[] | null>(null);
  const [containerImageOptions, setContainerImageOptions] = useState<string[] | null>(null);
  const [containerImageOptionsLoading, setContainerImageOptionsLoading] = useState(false);
  const [containerImageOptionsErr, setContainerImageOptionsErr] = useState<string | null>(null);

  const loadContainerImageOptions = useCallback(async () => {
    setContainerImageOptionsLoading(true);
    setContainerImageOptionsErr(null);
    try {
      const { images } = await fetchDockerImageOptions();
      setContainerImageOptions(images);
    } catch (e) {
      setContainerImageOptionsErr(e instanceof Error ? e.message : String(e));
      setContainerImageOptions([]);
    } finally {
      setContainerImageOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!rawMode) {
      void loadContainerImageOptions();
    }
  }, [rawMode, loadContainerImageOptions]);

  useEffect(() => {
    setRawDraft(content);
    setRawError("");
    try {
      if (!content.trim()) {
        setFormDoc({});
        return;
      }
      const v = YAML.parse(content);
      if (v && typeof v === "object" && !Array.isArray(v)) {
        setFormDoc(v as Record<string, unknown>);
      }
    } catch {
      /* Invalid YAML while editing raw — parent still holds the draft; keep form in sync only when parse succeeds. */
    }
  }, [content]);

  const modsSerialized = JSON.stringify(formDoc.mods ?? null);
  useEffect(() => {
    setModLines(initModLinesFromDoc(formDoc.mods));
    // `modsSerialized` is the dependency: stable proxy for `formDoc.mods` (avoids churn from object identity).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modsSerialized]);

  useEffect(() => {
    if (!modsValidationEnabled || rawMode) {
      setModsExists(null);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const { exists } = await postRecipeModsStatus(modLines);
          setModsExists(exists.length === modLines.length ? exists : null);
        } catch {
          setModsExists(null);
        }
      })();
    }, 400);
    return () => window.clearTimeout(t);
  }, [modLines, modsValidationEnabled, rawMode]);

  const patchDoc = useCallback(
    (next: Record<string, unknown>) => {
      setFormDoc(next);
      onContentChange(stringifyRecipe(next));
    },
    [onContentChange],
  );

  const syncRawFromForm = useCallback(() => {
    setRawDraft(stringifyRecipe(formDoc));
    setRawError("");
  }, [formDoc]);

  const applyRawYaml = useCallback(() => {
    try {
      const v = YAML.parse(rawDraft);
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        throw new Error("Root value must be a YAML mapping (object).");
      }
      const next = v as Record<string, unknown>;
      patchDoc(next);
      setRawError("");
    } catch (e) {
      setRawError(e instanceof Error ? e.message : "Invalid YAML");
    }
  }, [rawDraft, patchDoc]);

  const goToRaw = useCallback(() => {
    syncRawFromForm();
    setRawMode(true);
  }, [syncRawFromForm]);

  const goToForm = useCallback(() => {
    try {
      const v = YAML.parse(rawDraft);
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        throw new Error("Root value must be a YAML mapping (object).");
      }
      patchDoc(v as Record<string, unknown>);
      setRawMode(false);
      setRawError("");
    } catch (e) {
      setRawError(e instanceof Error ? e.message : "Invalid YAML");
    }
  }, [rawDraft, patchDoc]);

  const setScalar = (key: string, value: string | boolean | number) => {
    const next = { ...formDoc };
    if (value === "" && typeof value === "string") {
      delete next[key];
    } else {
      next[key] = value;
    }
    patchDoc(next);
  };

  const applyRecipeVersionChange = useCallback(
    (ver: string) => {
      const trimmed = ver.trim();
      const next: Record<string, unknown> = { ...formDoc };
      if (trimmed === "") {
        delete next.recipe_version;
      } else {
        next.recipe_version = trimmed;
      }
      const currentName = getStr(formDoc, "name");
      const base = stripRecipeVersionSuffix(currentName);
      if (trimmed === "") {
        if (base) {
          next.name = base;
        } else {
          delete next.name;
        }
      } else {
        next.name = base ? `${base} · v${trimmed}` : `v${trimmed}`;
      }
      patchDoc(next);
    },
    [formDoc, patchDoc],
  );

  const defaultsRestText = defaultsToYamlRest(formDoc.defaults);
  const defaultsObj = getDefaultsObject(formDoc.defaults);
  const maxModelLenCurrent = getNumericDefault(defaultsObj, "max_model_len");
  const maxBatchedCurrent = getNumericDefault(defaultsObj, "max_num_batched_tokens");
  const maxModelLenOpts = optionsWithCurrent(MAX_MODEL_LEN_OPTIONS, maxModelLenCurrent);
  const maxBatchedOpts = optionsWithCurrent(MAX_NUM_BATCHED_TOKENS_OPTIONS, maxBatchedCurrent);

  const containerVal = getStr(formDoc, "container");
  const containerSelectOptions = useMemo(() => {
    const base = containerImageOptions ?? [];
    const set = new Set<string>(base);
    const t = containerVal.trim();
    if (t) {
      set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [containerImageOptions, containerVal]);

  return (
    <div className={styles.root}>
      <div
        className={styles.modeRow}
        title={rawMode ? RAW_MODE_TOOLTIP : FORM_MODE_TOOLTIP}
      >
        <span className={styles.modeLabel}>Editor mode</span>
        <div className={styles.segment} role="group" aria-label="Editor mode">
          <button
            type="button"
            className={`${styles.segmentBtn} ${!rawMode ? styles.segmentBtnActive : ""}`}
            disabled={disabled}
            onClick={() => {
              if (rawMode) {
                goToForm();
              }
            }}
          >
            Form
          </button>
          <button
            type="button"
            className={`${styles.segmentBtn} ${rawMode ? styles.segmentBtnActive : ""}`}
            disabled={disabled}
            onClick={() => {
              goToRaw();
            }}
          >
            Raw YAML
          </button>
        </div>
      </div>

      {rawMode ? (
        <div className={styles.rawArea}>
          <textarea
            className={styles.rawTa}
            spellCheck={false}
            value={rawDraft}
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.value;
              setRawDraft(next);
              setRawError("");
              onContentChange(next);
            }}
            aria-label="Raw recipe YAML"
          />
          {rawError ? <div className={styles.rawError}>{rawError}</div> : null}
          <div className={styles.rawActions}>
            <button type="button" className={styles.btnGhost} disabled={disabled} onClick={applyRawYaml}>
              Apply raw YAML
            </button>
            <button type="button" className={styles.btnGhost} disabled={disabled} onClick={syncRawFromForm}>
              Reset to current form
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.formWrap}>
          <div className={styles.formGrid}>
            <div className={styles.span2}>
              <label className={styles.fieldLabel} htmlFor="rf-version">
                recipe_version
              </label>
              <input
                id="rf-version"
                className={styles.fieldInput}
                value={getStr(formDoc, "recipe_version")}
                disabled={disabled}
                onChange={(e) => {
                  applyRecipeVersionChange(e.target.value);
                }}
                autoComplete="off"
                title="Changing this updates the display name with a · v… suffix."
              />
              <p className={styles.fieldHint}>
                Updates the name field below to base title plus &quot; · v&quot; and the version. Any
                previous suffix in that form is replaced. Clearing version strips it from the name.
              </p>
            </div>
            <div className={styles.span2}>
              <label className={styles.fieldLabel} htmlFor="rf-name">
                name
              </label>
              <input
                id="rf-name"
                className={styles.fieldInput}
                value={getStr(formDoc, "name")}
                disabled={disabled}
                onChange={(e) => {
                  setScalar("name", e.target.value);
                }}
                autoComplete="off"
              />
            </div>
            <div className={styles.span2}>
              <label className={styles.fieldLabel} htmlFor="rf-container">
                container
              </label>
              <div className={styles.fieldContainerWrap}>
                <select
                  id="rf-container"
                  className={`${styles.fieldSelect} ${styles.fieldContainerSelect}`}
                  disabled={disabled}
                  value={containerVal}
                  onChange={(e) => {
                    setScalar("container", e.target.value);
                  }}
                >
                  <option value="">—</option>
                  {containerSelectOptions.map((img) => (
                    <option key={img} value={img}>
                      {img}
                    </option>
                  ))}
                </select>
                <div className={styles.fieldContainerRefresh}>
                  <ToolbarIconButton
                    variant="muted"
                    label={
                      containerImageOptionsLoading
                        ? "Scanning Docker images…"
                        : "Refresh image list from Docker"
                    }
                    disabled={disabled || containerImageOptionsLoading}
                    busy={containerImageOptionsLoading}
                    onClick={() => {
                      void loadContainerImageOptions();
                    }}
                  >
                    <IconRefresh />
                  </ToolbarIconButton>
                </div>
              </div>
              <p className={styles.fieldHint}>
                Native menu like <code className={styles.codeInline}>max_model_len</code> — Refresh reloads
                images from Docker. The current tag stays in the list; anything else, edit Raw YAML.
              </p>
              {containerImageOptionsErr ? (
                <p className={styles.fieldHint} role="status">
                  {containerImageOptionsErr}
                </p>
              ) : null}
            </div>
            <div className={styles.span2}>
              <label className={styles.fieldLabel} htmlFor="rf-desc">
                description
              </label>
              <input
                id="rf-desc"
                className={styles.fieldInput}
                value={getStr(formDoc, "description")}
                disabled={disabled}
                onChange={(e) => {
                  setScalar("description", e.target.value);
                }}
                autoComplete="off"
              />
            </div>
            <div className={styles.span2}>
              <label className={styles.fieldLabel} htmlFor="rf-model">
                model (HF id)
              </label>
              <input
                id="rf-model"
                className={styles.fieldInput}
                value={getStr(formDoc, "model")}
                disabled={disabled}
                onChange={(e) => {
                  setScalar("model", e.target.value);
                }}
                autoComplete="off"
              />
            </div>
            <div className={styles.checkRow}>
              <label>
                <input
                  type="checkbox"
                  checked={getBool(formDoc, "cluster_only")}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = { ...formDoc };
                    if (!e.target.checked) {
                      delete next.cluster_only;
                    } else {
                      next.cluster_only = true;
                    }
                    patchDoc(next);
                  }}
                />
                cluster_only
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={getBool(formDoc, "solo_only")}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = { ...formDoc };
                    if (!e.target.checked) {
                      delete next.solo_only;
                    } else {
                      next.solo_only = true;
                    }
                    patchDoc(next);
                  }}
                />
                solo_only
              </label>
            </div>
            <div className={styles.span2}>
              <label className={styles.fieldLabel} htmlFor="rf-mods-0">
                mods (one path per line, under{" "}
                <code className={styles.codeInline}>$SPARK_VLLM_ROOT/mods/</code>)
              </label>
              <div className={styles.modsStack}>
                {modLines.map((line, i) => {
                  const missing =
                    modsExists !== null &&
                    modsExists.length === modLines.length &&
                    line.trim() !== "" &&
                    modsExists[i] === false;
                  return (
                    <div key={i} className={styles.modsRow}>
                      {missing ? (
                        <span
                          className={styles.modsWarn}
                          title="Path not found on server under mods/"
                          aria-hidden
                        >
                          !
                        </span>
                      ) : (
                        <span className={styles.modsWarnPad} aria-hidden />
                      )}
                      <input
                        id={i === 0 ? "rf-mods-0" : undefined}
                        type="text"
                        className={missing ? `${styles.modsInput} ${styles.modsInputMissing}` : styles.modsInput}
                        aria-invalid={missing}
                        spellCheck={false}
                        autoComplete="off"
                        disabled={disabled}
                        value={line}
                        onChange={(e) => {
                          const next = [...modLines];
                          next[i] = e.target.value;
                          if (i === next.length - 1 && e.target.value.trim() !== "") {
                            next.push("");
                          }
                          setModLines(next);
                          const merged = linesToMods(next.join("\n"));
                          const patch = { ...formDoc };
                          if (merged.length === 0) {
                            delete patch.mods;
                          } else {
                            patch.mods = merged;
                          }
                          patchDoc(patch);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={styles.span2}>
              <div className={styles.defaultsBlock}>
                <span className={styles.fieldLabel}>defaults</span>
                <p className={styles.defaultsHint}>
                  Length limits use fixed presets. <code className={styles.codeInline}>enforce_eager</code> is a
                  vLLM engine toggle. Anything else goes under other defaults.
                </p>
                <div className={styles.defaultsGrid}>
                  <label className={styles.selectWrap} htmlFor="rf-defaults-max-model-len">
                    <span className={styles.selectLabel}>max_model_len</span>
                    <select
                      id="rf-defaults-max-model-len"
                      className={styles.fieldSelect}
                      disabled={disabled}
                      value={maxModelLenCurrent === undefined ? "" : String(maxModelLenCurrent)}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = { ...formDoc };
                        const d = getDefaultsObject(formDoc.defaults);
                        if (v === "") {
                          delete d.max_model_len;
                        } else {
                          d.max_model_len = Number.parseInt(v, 10);
                        }
                        if (Object.keys(d).length === 0) {
                          delete next.defaults;
                        } else {
                          next.defaults = d;
                        }
                        patchDoc(next);
                      }}
                    >
                      <option value="">—</option>
                      {maxModelLenOpts.map((n) => (
                        <option key={n} value={String(n)}>
                          {n.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.selectWrap} htmlFor="rf-defaults-max-batched">
                    <span className={styles.selectLabel}>max_num_batched_tokens</span>
                    <select
                      id="rf-defaults-max-batched"
                      className={styles.fieldSelect}
                      disabled={disabled}
                      value={maxBatchedCurrent === undefined ? "" : String(maxBatchedCurrent)}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = { ...formDoc };
                        const d = getDefaultsObject(formDoc.defaults);
                        if (v === "") {
                          delete d.max_num_batched_tokens;
                        } else {
                          d.max_num_batched_tokens = Number.parseInt(v, 10);
                        }
                        if (Object.keys(d).length === 0) {
                          delete next.defaults;
                        } else {
                          next.defaults = d;
                        }
                        patchDoc(next);
                      }}
                    >
                      <option value="">—</option>
                      {maxBatchedOpts.map((n) => (
                        <option key={n} value={String(n)}>
                          {n.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={styles.toggleRow}>
                  <input
                    type="checkbox"
                    checked={defaultsObj.enforce_eager === true}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = { ...formDoc };
                      const d = getDefaultsObject(formDoc.defaults);
                      if (e.target.checked) {
                        d.enforce_eager = true;
                      } else {
                        delete d.enforce_eager;
                      }
                      if (Object.keys(d).length === 0) {
                        delete next.defaults;
                      } else {
                        next.defaults = d;
                      }
                      patchDoc(next);
                    }}
                  />
                  <span>enforce_eager</span>
                </label>
                <label className={styles.fieldLabel} htmlFor="rf-defaults-rest">
                  other defaults (YAML)
                </label>
                <textarea
                  id="rf-defaults-rest"
                  className={styles.fieldTextarea}
                  rows={6}
                  value={defaultsRestText}
                  disabled={disabled}
                  onChange={(e) => {
                    const t = e.target.value;
                    if (!t.trim()) {
                      setDefaultsError("");
                      const prev = getDefaultsObject(formDoc.defaults);
                      const keep: Record<string, unknown> = {};
                      for (const k of DEFAULTS_STRUCTURED_KEYS) {
                        if (prev[k] !== undefined) {
                          keep[k] = prev[k];
                        }
                      }
                      const next = { ...formDoc };
                      if (Object.keys(keep).length === 0) {
                        delete next.defaults;
                      } else {
                        next.defaults = keep;
                      }
                      patchDoc(next);
                      return;
                    }
                    const parsed = parseDefaultsYaml(t);
                    if (parsed === null) {
                      setDefaultsError("Invalid YAML for other defaults");
                      return;
                    }
                    setDefaultsError("");
                    const prev = getDefaultsObject(formDoc.defaults);
                    const merged = { ...parsed };
                    for (const k of DEFAULTS_STRUCTURED_KEYS) {
                      if (prev[k] !== undefined) {
                        merged[k] = prev[k];
                      }
                    }
                    const next = { ...formDoc };
                    next.defaults = merged;
                    patchDoc(next);
                  }}
                />
                {defaultsError ? <p className={styles.fieldError}>{defaultsError}</p> : null}
              </div>
            </div>
            <div className={styles.span2}>
              <label className={styles.fieldLabel} htmlFor="rf-env">
                env (KEY=value per line)
              </label>
              <textarea
                id="rf-env"
                className={styles.fieldTextarea}
                rows={4}
                value={envToLines(formDoc.env)}
                disabled={disabled}
                onChange={(e) => {
                  const next = { ...formDoc };
                  const env = linesToEnv(e.target.value);
                  if (Object.keys(env).length === 0) {
                    delete next.env;
                  } else {
                    next.env = env;
                  }
                  patchDoc(next);
                }}
              />
            </div>
            <div className={styles.span2}>
              <label className={styles.fieldLabel} htmlFor="rf-build">
                build_args (one arg per line)
              </label>
              <textarea
                id="rf-build"
                className={styles.fieldTextarea}
                rows={3}
                value={buildArgsToLines(formDoc.build_args)}
                disabled={disabled}
                onChange={(e) => {
                  const next = { ...formDoc };
                  const a = linesToBuildArgs(e.target.value);
                  if (a.length === 0) {
                    delete next.build_args;
                  } else {
                    next.build_args = a;
                  }
                  patchDoc(next);
                }}
              />
            </div>
            <div className={styles.span2}>
              <label className={styles.fieldLabel} htmlFor="rf-cmd">
                command
              </label>
              <textarea
                id="rf-cmd"
                className={`${styles.fieldTextarea} ${styles.commandTa}`}
                rows={12}
                value={getStr(formDoc, "command")}
                disabled={disabled}
                onChange={(e) => {
                  setScalar("command", e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
