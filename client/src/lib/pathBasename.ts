/** Last path segment for display (POSIX-style); empty/undefined → `fallback`. */
export function basenamePath(abs: string | undefined, fallback = "recipes"): string {
  if (!abs?.trim()) {
    return fallback;
  }
  const s = abs.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(i + 1) : s;
}
