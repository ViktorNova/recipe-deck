export const THEME_STORAGE_KEY = "recipe-deck-theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (t === "light" || t === "dark") {
      return t;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(): Theme {
  return getStoredTheme() ?? getSystemTheme();
}

export function readThemeFromDocument(): Theme {
  const a = document.documentElement.getAttribute("data-theme");
  if (a === "dark" || a === "light") {
    return a;
  }
  return resolveTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}
