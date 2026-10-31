import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "receipt-pal-theme";
const media = () => window.matchMedia("(prefers-color-scheme: light)");

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "system";
}

function apply(preference: ThemePreference) {
  const resolved = preference === "system" ? (media().matches ? "light" : "dark") : preference;
  document.documentElement.dataset.theme = resolved;
}

export function useTheme(): [ThemePreference, (preference: ThemePreference) => void] {
  const [preference, setPreference] = useState(readPreference);

  useEffect(() => {
    apply(preference);
    try {
      if (preference === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {}
    if (preference !== "system") return;
    const query = media();
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  return [preference, setPreference];
}
