import { create } from "zustand";

export type Theme =
  | "light"
  | "dark"
  | "system"
  | "nature"
  | "darkblue"
  | "calmgreen"
  | "pastelpink"
  | "punkprincess";

const NAMED_THEMES: Theme[] = [
  "nature",
  "darkblue",
  "calmgreen",
  "pastelpink",
  "punkprincess",
];

export interface Toast {
  id: number;
  kind: "info" | "error" | "ok";
  text: string;
}

interface UiState {
  theme: Theme;
  modelsOpen: boolean;
  settingsOpen: boolean;
  historyOpen: boolean;
  toasts: Toast[];

  setTheme: (t: Theme) => void;
  setModelsOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  toggleHistory: () => void;
  pushToast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
}

const THEME_KEY = "localtranslate.theme";

function loadTheme(): Theme {
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" || v === "system" || NAMED_THEMES.includes(v as Theme)
    ? (v as Theme)
    : "system";
}

/** Aplica o tema no <html data-theme> (resolvendo "system" pela mídia). */
export function applyTheme(theme: Theme) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = resolved;
}

let nextToast = 1;

export const useUi = create<UiState>((set) => ({
  theme: loadTheme(),
  modelsOpen: false,
  settingsOpen: false,
  historyOpen: false,
  toasts: [],

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
    set({ theme });
  },
  setModelsOpen: (modelsOpen) => set({ modelsOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),
  pushToast: (kind, text) =>
    set((s) => ({ toasts: [...s.toasts, { id: nextToast++, kind, text }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
