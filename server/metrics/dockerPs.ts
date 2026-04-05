import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DockerContainerInfo, DockerListRow } from "../../types/index.js";

const execFileAsync = promisify(execFile);

/**
 * Normalize ID from `docker ps` / API: strip optional `sha256:` prefix, require 12–64 hex chars.
 * `docker stop` accepts this form.
 */
export function normalizeDockerContainerId(raw: string): string | null {
  let s = raw.trim();
  if (s.toLowerCase().startsWith("sha256:")) {
    s = s.slice(7).trim();
  }
  if (!/^[a-fA-F0-9]{12,64}$/.test(s)) {
    return null;
  }
  return s;
}

/** Full or short container ID from `docker ps` (hex only). */
export function isValidDockerContainerId(id: string): boolean {
  return normalizeDockerContainerId(id) !== null;
}

/**
 * Best-effort: find a running container that publishes `hostPort` (same idea as
 * checking `docker ps` for `0.0.0.0:8000->…`).
 */
export async function findDockerContainerForHostPort(
  hostPort: number,
): Promise<DockerContainerInfo | null> {
  if (!Number.isFinite(hostPort) || hostPort <= 0 || hostPort > 65535) {
    return null;
  }
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["ps", "--no-trunc", "--format", "{{json .}}"],
      { timeout: 12_000, maxBuffer: 2 * 1024 * 1024 },
    );
    const needle = `:${hostPort}->`;
    for (const line of stdout.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || !t.includes(needle)) continue;
      const row = parseDockerPsJsonLine(t) ?? parseDockerPsTabLine(t);
      if (!row) continue;
      if (!row.image) continue;
      return {
        image: row.image,
        containerName: row.names || "(unnamed)",
      };
    }
  } catch {
    return null;
  }
  return null;
}

type ParsedRow = { id: string; image: string; names: string; ports: string };

function parseDockerPsJsonLine(line: string): ParsedRow | null {
  try {
    const j = JSON.parse(line) as Record<string, unknown>;
    const idRaw = j.ID ?? j.Id ?? j.id;
    if (typeof idRaw !== "string") return null;
    const id = normalizeDockerContainerId(idRaw);
    if (!id) return null;
    const image = typeof j.Image === "string" ? j.Image : "";
    let names = "";
    if (typeof j.Names === "string") {
      names = j.Names;
    } else if (Array.isArray(j.Names)) {
      names = (j.Names as unknown[]).filter((x) => typeof x === "string").join(", ");
    }
    const ports = typeof j.Ports === "string" ? j.Ports : "";
    return { id, image, names, ports };
  } catch {
    return null;
  }
}

/** Legacy tab format (breaks if image contains `\\t`). */
function parseDockerPsTabLine(line: string): ParsedRow | null {
  const parts = line.split("\t");
  if (parts.length < 4) return null;
  const id = normalizeDockerContainerId(parts[0]?.trim() ?? "");
  if (!id) return null;
  return {
    id,
    image: parts[1]?.trim() ?? "",
    names: parts[2]?.trim() ?? "",
    ports: parts[3]?.trim() ?? "",
  };
}

/** Local image refs from `docker images` (`repository:tag`, skips dangling `<none>` rows). */
export async function listLocalDockerImageRefs(): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "docker",
    ["images", "--format", "{{.Repository}}:{{.Tag}}"],
    { timeout: 20_000, maxBuffer: 2 * 1024 * 1024 },
  );
  const out = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.includes("<none>")) {
      continue;
    }
    out.add(t);
  }
  return Array.from(out);
}

/** All running containers (`docker ps`), for UI stop controls. */
export async function listRunningDockerContainers(): Promise<DockerListRow[]> {
  const { stdout } = await execFileAsync(
    "docker",
    ["ps", "--no-trunc", "--format", "{{json .}}"],
    { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 },
  );
  const out: DockerListRow[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const row = parseDockerPsJsonLine(t) ?? parseDockerPsTabLine(t);
    if (!row) continue;
    out.push({
      id: row.id,
      image: row.image,
      names: row.names,
      ports: row.ports,
    });
  }
  return out;
}

export async function stopDockerContainer(containerId: string): Promise<void> {
  const id = normalizeDockerContainerId(containerId);
  if (!id) {
    throw new Error("Invalid container id");
  }
  await execFileAsync("docker", ["stop", id], {
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
}
