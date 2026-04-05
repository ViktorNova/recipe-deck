import YAML from "yaml";

/** Mirrors server `recipeDeckMeta.setRecipeDeckBroken` for client-side merges. */
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

/** Apply `recipe_deck.broken` to the current YAML string (editor buffer), same semantics as the server. */
export function applyBrokenToYaml(yamlText: string, broken: boolean): string {
  const doc = YAML.parse(yamlText) as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") {
    throw new Error("Invalid YAML");
  }
  setRecipeDeckBroken(doc, broken);
  return YAML.stringify(doc, { lineWidth: 0 });
}
