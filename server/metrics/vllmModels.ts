/**
 * Parse OpenAI-style `GET /v1/models` JSON (vLLM and variants).
 */
export function extractModelIdsFromOpenAiModelsJson(
  j: Record<string, unknown>,
): string[] {
  const data = j.data;
  if (!Array.isArray(data)) {
    return [];
  }
  const ids: string[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const raw = m.id ?? m.model ?? m.name ?? m.root;
    if (typeof raw === "string" && raw.length > 0) {
      ids.push(raw);
    }
  }
  return ids;
}

/**
 * OpenAI-compatible discovery: served model IDs from vLLM.
 * @see https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html
 */
export async function fetchServedModelIds(port: number): Promise<string[] | null> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/v1/models`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (!r.ok) {
      return null;
    }
    const j = (await r.json()) as Record<string, unknown>;
    const ids = extractModelIdsFromOpenAiModelsJson(j);
    return ids.length > 0 ? ids : [];
  } catch {
    return null;
  }
}
