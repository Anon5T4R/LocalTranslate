// Wrappers dos comandos Rust (Tauri v2: chaves camelCase no invoke).
// Fora do Tauri (dev no navegador puro) os comandos rejeitam, e a UI trata.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  DirectionStatus,
  DocProgress,
  DownloadDone,
  DownloadProgress,
  HistoryEntry,
  QuickConfig,
} from "./types";

export function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function cmd<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!inTauri()) return Promise.reject(new Error(`fora do Tauri: ${name}`));
  return invoke<T>(name, args);
}

// --- arquivos ---
export const getStartupFile = () => cmd<string | null>("get_startup_file");
export const readTextFile = (path: string) => cmd<string>("read_text_file", { path });
export const writeTextFile = (path: string, content: string) =>
  cmd<void>("write_text_file", { path, content });

// --- modelos ---
export const modelsStatus = () => cmd<DirectionStatus[]>("models_status");
export const downloadModel = (leg: string) => cmd<void>("download_model", { leg });
export const cancelDownload = (leg: string) => cmd<void>("cancel_download", { leg });
export const removeModel = (leg: string) => cmd<void>("remove_model", { leg });

// --- tradução ---
export const translateText = (direction: string, text: string) =>
  cmd<string>("translate_text", { direction, text });

// --- tradução de documento (.txt/.md) ---
export const translateDocument = (direction: string, text: string, markdown: boolean) =>
  cmd<string>("translate_document", { direction, text, markdown });
export const cancelDocument = () => cmd<void>("cancel_document");
export const documentUnits = (text: string, markdown: boolean) =>
  cmd<number>("document_units", { text, markdown });

// --- janela rápida ---
export const quickConfig = () => cmd<QuickConfig>("quick_config");
export const quickConfigSet = (cfg: QuickConfig) => cmd<void>("quick_config_set", { cfg });
export const quickHide = () => cmd<void>("quick_hide");
export const clipboardRead = () => cmd<string>("clipboard_read");
export const clipboardWrite = (text: string) => cmd<void>("clipboard_write", { text });

// --- histórico ---
export const historyList = () => cmd<HistoryEntry[]>("history_list");
export const historyAdd = (direction: string, source: string, result: string) =>
  cmd<HistoryEntry | null>("history_add", { direction, source, result });
export const historyDelete = (id: number) => cmd<void>("history_delete", { id });
export const historyClear = () => cmd<void>("history_clear");

// --- eventos ---
export function onDownloadProgress(cb: (p: DownloadProgress) => void): Promise<UnlistenFn> {
  return listen<DownloadProgress>("download-progress", (e) => cb(e.payload));
}
export function onDownloadDone(cb: (d: DownloadDone) => void): Promise<UnlistenFn> {
  return listen<DownloadDone>("download-done", (e) => cb(e.payload));
}
export function onOpenFile(cb: (path: string) => void): Promise<UnlistenFn> {
  return listen<string>("open-file", (e) => cb(e.payload));
}
export function onDocProgress(cb: (p: DocProgress) => void): Promise<UnlistenFn> {
  return listen<DocProgress>("doc-progress", (e) => cb(e.payload));
}
export function onQuickOpen(cb: (clipboard: string) => void): Promise<UnlistenFn> {
  return listen<string>("quick-open", (e) => cb(e.payload));
}
export function onQuickBlur(cb: () => void): Promise<UnlistenFn> {
  return listen("quick-blur", () => cb());
}

/** Formata bytes em unidade legível (MB/GB). */
export function fmtBytes(bytes: number): string {
  if (bytes >= 1 << 30) return `${(bytes / (1 << 30)).toFixed(2)} GB`;
  if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(0)} MB`;
  if (bytes >= 1 << 10) return `${(bytes / (1 << 10)).toFixed(0)} KB`;
  return `${bytes} B`;
}
