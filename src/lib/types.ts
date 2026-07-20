// Tipos espelhando os payloads do back (camelCase via serde rename_all).

export interface LegStatus {
  leg: string;
  installed: boolean;
  downloading: boolean;
  bytes: number;
}

export interface DirectionStatus {
  direction: string;
  installed: boolean;
  downloading: boolean;
  bytes: number;
  legs: LegStatus[];
}

export interface HistoryEntry {
  id: number;
  createdMs: number;
  direction: string;
  source: string;
  result: string;
}

export interface DownloadProgress {
  leg: string;
  received: number;
  total: number;
}

export interface DocProgress {
  done: number;
  total: number;
}

export interface QuickConfig {
  shortcut: string;
  enabled: boolean;
  direction: string;
  hideOnBlur: boolean;
  keepInTray: boolean;
}

export interface DownloadDone {
  leg: string;
  ok: boolean;
  error: string | null;
}
