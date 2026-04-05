import YAML from "yaml";

/** Recipe Deck–only metadata in YAML (ignored by spark-vllm-docker). */
export function parseRecipeBroken(yamlText: string): boolean {
  try {
    const doc = YAML.parse(yamlText) as Record<string, unknown> | null;
    if (!doc || typeof doc !== "object") {
      return false;
    }
    const rd = doc.recipe_deck;
    if (rd && typeof rd === "object" && rd !== null && "broken" in rd) {
      return Boolean((rd as { broken?: unknown }).broken);
    }
    return false;
  } catch {
    return false;
  }
}

function setRecipeDeckBroken(doc: Record<string, unknown>, broken: boolean): void {
  if (!broken) {
    const rd = doc.recipe_deck;
    if (rd && typeof rd === "object" && rd !== null) {
      delete (rd as Record<string, unknown>).broken;
      if (Object.keys(rd as Record<string, unknown>).length === 0) {
        /* Keep an empty object so POST /api/recipe/save does not treat recipe_deck as
         * "omitted" and re-merge broken:true from disk (mergeRecipeDeckFromExisting). */
        doc.recipe_deck = {};
      }
    }
    return;
  }
  const prev =
    doc.recipe_deck && typeof doc.recipe_deck === "object" && doc.recipe_deck !== null
      ? (doc.recipe_deck as Record<string, unknown>)
      : {};
  doc.recipe_deck = { ...prev, broken: true };
}

/** Merge `recipe_deck` from disk when the incoming save omits it (keeps broken flag if editor stripped the block). */
export function mergeRecipeDeckFromExisting(
  incomingYaml: string,
  existingYaml: string | null,
): string {
  if (!existingYaml) {
    return incomingYaml;
  }
  try {
    const incoming = YAML.parse(incomingYaml) as Record<string, unknown> | null;
    if (!incoming || typeof incoming !== "object") {
      return incomingYaml;
    }
    if (incoming.recipe_deck !== undefined) {
      return incomingYaml;
    }
    const existing = YAML.parse(existingYaml) as Record<string, unknown> | null;
    if (
      existing &&
      typeof existing === "object" &&
      existing.recipe_deck !== undefined
    ) {
      incoming.recipe_deck = existing.recipe_deck;
    }
    return YAML.stringify(incoming, { lineWidth: 0 });
  } catch {
    return incomingYaml;
  }
}

export function applyBrokenToYaml(yamlText: string, broken: boolean): string {
  const doc = YAML.parse(yamlText) as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") {
    throw new Error("Invalid YAML");
  }
  setRecipeDeckBroken(doc, broken);
  return YAML.stringify(doc, { lineWidth: 0 });
}
