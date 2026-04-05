import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Best-effort: free TCP listeners on `port` (Linux: fuser/lsof).
 */
export async function killListenersOnPort(port: number): Promise<void> {
  const shell = "sh";
  const script = `
    (command -v fuser >/dev/null 2>&1 && fuser -k ${port}/tcp 2>/dev/null) || true
    (command -v lsof >/dev/null 2>&1 && P=$(lsof -ti:${port} -sTCP:LISTEN 2>/dev/null) && [ -n "$P" ] && kill -9 $P) || true
  `;
  try {
    await execFileAsync(shell, ["-c", script], { timeout: 10_000 });
  } catch {
    /* ignore */
  }
}
