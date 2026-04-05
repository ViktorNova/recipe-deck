/**
 * Pretty-print `host:port` for logs and UI (bracket IPv6 when needed).
 */
export function formatListenDisplay(host: string, port: number): string {
  const h =
    host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `${h}:${port}`;
}
