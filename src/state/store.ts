import { create } from "zustand";
import {
  historyAdd,
  historyClear,
  historyDelete,
  historyList,
  modelsStatus,
  translateText,
} from "../lib/backend";
import { dirId, type Lang } from "../lib/langs";
import type { DirectionStatus, HistoryEntry } from "../lib/types";

interface Progress {
  received: number;
  total: number;
}

interface AppState {
  from: Lang;
  to: Lang;
  source: string;
  result: string;
  translating: boolean;
  error: string | null;
  /** Direção cujo modelo falta baixar (dispara o banner de download). */
  modelMissing: string | null;
  history: HistoryEntry[];
  models: DirectionStatus[];
  /** Progresso de download por perna ("en-pt" → bytes). */
  progress: Record<string, Progress>;

  setFrom: (l: Lang) => void;
  setTo: (l: Lang) => void;
  swap: () => void;
  setSource: (t: string) => void;
  clearMissing: () => void;

  translate: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadModels: () => Promise<void>;
  useEntry: (e: HistoryEntry) => void;
  removeEntry: (id: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  setProgress: (leg: string, p: Progress | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  from: "en",
  to: "pt",
  source: "",
  result: "",
  translating: false,
  error: null,
  modelMissing: null,
  history: [],
  models: [],
  progress: {},

  setFrom: (from) => {
    const to = get().to === from ? get().from : get().to;
    set({ from, to, modelMissing: null });
  },
  setTo: (to) => {
    const from = get().from === to ? get().to : get().from;
    set({ from, to, modelMissing: null });
  },
  swap: () =>
    set((s) => ({
      from: s.to,
      to: s.from,
      source: s.result || s.source,
      result: s.result ? s.source : "",
      modelMissing: null,
    })),
  setSource: (source) => set({ source }),
  clearMissing: () => set({ modelMissing: null }),

  translate: async () => {
    const { from, to, source } = get();
    const text = source.trim();
    if (!text || get().translating) return;
    const direction = dirId(from, to);
    set({ translating: true, error: null, modelMissing: null });
    try {
      const result = await translateText(direction, source);
      set({ result, translating: false });
      const entry = await historyAdd(direction, source, result);
      if (entry) {
        set((s) => ({
          history: [entry, ...s.history.filter((h) => h.id !== entry.id)],
        }));
      }
    } catch (e) {
      const msg = typeof e === "string" ? e : String((e as Error)?.message ?? e);
      if (msg.includes("MODEL_MISSING")) {
        set({ translating: false, modelMissing: direction });
      } else {
        set({ translating: false, error: msg });
      }
    }
  },

  loadHistory: async () => {
    try {
      set({ history: await historyList() });
    } catch {
      /* fora do Tauri */
    }
  },
  loadModels: async () => {
    try {
      set({ models: await modelsStatus() });
    } catch {
      /* fora do Tauri */
    }
  },
  useEntry: (e) => {
    const [from, to] = e.direction.split("-") as [Lang, Lang];
    set({ from, to, source: e.source, result: e.result, modelMissing: null });
  },
  removeEntry: async (id) => {
    await historyDelete(id).catch(() => {});
    set((s) => ({ history: s.history.filter((h) => h.id !== id) }));
  },
  clearHistory: async () => {
    await historyClear().catch(() => {});
    set({ history: [] });
  },
  setProgress: (leg, p) =>
    set((s) => {
      const progress = { ...s.progress };
      if (p) progress[leg] = p;
      else delete progress[leg];
      return { progress };
    }),
}));
