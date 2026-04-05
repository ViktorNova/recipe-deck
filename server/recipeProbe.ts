/**
 * Lightweight parse of recipe YAML text for debugging (no full YAML dependency).
 * Used to confirm which model/container/gpu_mem the file on disk contains.
 */
function stripYamlComment(s: string): string {
  const i = s.indexOf("#");
  if (i < 0) return s.trim();
  return s.slice(0, i).trim();
}

export function probeRecipeYaml(content: string): {
  model: string | null;
  container: string | null;
  gpuMemDefault: string | null;
} {
  const stripQuotes = (s: string) => s.replace(/^["']|["']$/gu, "").trim();
  const modelM = content.match(/^model:\s*(.+)$/m);
  const containerM = content.match(/^container:\s*(.+)$/m);
  const model =
    modelM?.[1] != null ? stripQuotes(stripYamlComment(modelM[1])) : null;
  const container =
    containerM?.[1] != null
      ? stripQuotes(stripYamlComment(containerM[1]))
      : null;
  // Do not anchor to EOL: values often have trailing `# comment` (e.g. under defaults:).
  const gpuMemDefault =
    content.match(/^\s*gpu_memory_utilization:\s*([0-9.]+)/m)?.[1] ?? null;
  return {
    model: model || null,
    container: container || null,
    gpuMemDefault: gpuMemDefault || null,
  };
}
