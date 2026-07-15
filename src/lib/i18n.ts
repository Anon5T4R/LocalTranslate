import { useSyncExternalStore } from "react";

/**
 * i18n leve da UI (mesmo padrão do LocalCode). O dicionário `pt` é a fonte da
 * verdade das chaves; `en`/`es` como `Record<MessageKey, string>` fazem o
 * compilador recusar chave faltando ou sobrando. O locale vive num store
 * externo (não React) pra o `t()` poder ser chamado de código fora de
 * componente (toasts do store/App); o App remonta a árvore na troca
 * (key={locale} no main.tsx).
 *
 * Obs.: os nomes dos idiomas (Português/English/Español) são endônimos e NÃO
 * são traduzidos — cada idioma aparece no próprio nome (ver lib/langs.ts).
 */

export type Locale = "pt" | "en" | "es";

export const LOCALE_LABELS: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

const LOCALE_KEY = "localtranslate.locale";

const pt = {
  // TopBar
  "topbar.historyTitle": "Histórico de traduções",
  "topbar.history": "Histórico",
  "topbar.modelsTitle": "Gerenciar modelos de idioma",
  "topbar.models": "Modelos",
  "topbar.settingsTitle": "Configurações",

  // TranslatePanel
  "panel.swapTitle": "Inverter idiomas",
  "panel.openFileTitle": "Abrir arquivo .txt/.md",
  "panel.openFile": "Abrir arquivo",
  "panel.looksLike": "Parece {lang}.",
  "panel.swapTo": "Inverter para {dir}",
  "panel.modelMissingPre": "O modelo para",
  "panel.modelMissingPost": "ainda não foi baixado.",
  "panel.downloadNow": "Baixar agora",
  "panel.sourcePlaceholder": "Digite ou cole o texto…  (Ctrl+Enter traduz)",
  "panel.translating": "Traduzindo…",
  "panel.resultPlaceholder": "Tradução",
  "panel.translate": "Traduzir",
  "panel.clear": "limpar",
  "panel.copy": "copiar",

  // Toasts
  "toast.copied": "Tradução copiada",
  "toast.copyFailed": "Não consegui copiar",
  "toast.readFailed": "Falha ao ler o arquivo",
  "toast.openFailed": "Não consegui abrir o arquivo.",
  "toast.modelInstalled": "Modelo {leg} instalado",
  "toast.modelRemoved": "Modelo {leg} removido",
  "toast.downloadFailed": "Falha ao baixar {leg}: {error}",

  // Settings
  "settings.title": "Configurações",
  "settings.theme": "Tema",
  "settings.themeSystem": "Sistema",
  "settings.themeLight": "Claro",
  "settings.themeDark": "Escuro",
  "settings.language": "Idioma",
  "settings.about":
    " — tradutor offline (pt-BR · es · en), 100% local, sem nuvem. Motor Marian/OPUS-MT (Helsinki-NLP) no candle. Parte da suíte Local.",

  // History
  "history.title": "Histórico",
  "history.clearAll": "limpar tudo",
  "history.empty": "Nada traduzido ainda.",
  "history.reopenTitle": "Reabrir esta tradução",
  "history.deleteTitle": "Excluir",
  "time.now": "agora",
  "time.min": "{n} min",
  "time.hour": "{n} h",

  // Models
  "models.title": "Modelos de idioma",
  "models.sub":
    "Baixe só os pares que usar. Português ↔ Espanhol reaproveita os modelos via inglês (não tem download próprio).",
  "models.installed": "instalado",
  "models.cancel": "cancelar",
  "models.remove": "remover",
  "models.download": "baixar",
  "models.foot1": "Os modelos ficam em",
  "models.foot2":
    ". Ficam na RAM só enquanto em uso e são descarregados depois de alguns minutos parados.",
} as const;

export type MessageKey = keyof typeof pt;

const en: Record<MessageKey, string> = {
  "topbar.historyTitle": "Translation history",
  "topbar.history": "History",
  "topbar.modelsTitle": "Manage language models",
  "topbar.models": "Models",
  "topbar.settingsTitle": "Settings",

  "panel.swapTitle": "Swap languages",
  "panel.openFileTitle": "Open .txt/.md file",
  "panel.openFile": "Open file",
  "panel.looksLike": "Looks like {lang}.",
  "panel.swapTo": "Swap to {dir}",
  "panel.modelMissingPre": "The model for",
  "panel.modelMissingPost": "hasn't been downloaded yet.",
  "panel.downloadNow": "Download now",
  "panel.sourcePlaceholder": "Type or paste text…  (Ctrl+Enter translates)",
  "panel.translating": "Translating…",
  "panel.resultPlaceholder": "Translation",
  "panel.translate": "Translate",
  "panel.clear": "clear",
  "panel.copy": "copy",

  "toast.copied": "Translation copied",
  "toast.copyFailed": "Couldn't copy",
  "toast.readFailed": "Failed to read the file",
  "toast.openFailed": "Couldn't open the file.",
  "toast.modelInstalled": "Model {leg} installed",
  "toast.modelRemoved": "Model {leg} removed",
  "toast.downloadFailed": "Failed to download {leg}: {error}",

  "settings.title": "Settings",
  "settings.theme": "Theme",
  "settings.themeSystem": "System",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.language": "Language",
  "settings.about":
    " — offline translator (pt-BR · es · en), 100% local, no cloud. Marian/OPUS-MT (Helsinki-NLP) engine on candle. Part of the Local suite.",

  "history.title": "History",
  "history.clearAll": "clear all",
  "history.empty": "Nothing translated yet.",
  "history.reopenTitle": "Reopen this translation",
  "history.deleteTitle": "Delete",
  "time.now": "now",
  "time.min": "{n} min",
  "time.hour": "{n} h",

  "models.title": "Language models",
  "models.sub":
    "Download only the pairs you use. Portuguese ↔ Spanish reuses the models via English (no separate download).",
  "models.installed": "installed",
  "models.cancel": "cancel",
  "models.remove": "remove",
  "models.download": "download",
  "models.foot1": "Models are stored in",
  "models.foot2":
    ". They stay in RAM only while in use and are unloaded after a few idle minutes.",
};

const es: Record<MessageKey, string> = {
  "topbar.historyTitle": "Historial de traducciones",
  "topbar.history": "Historial",
  "topbar.modelsTitle": "Gestionar modelos de idioma",
  "topbar.models": "Modelos",
  "topbar.settingsTitle": "Configuración",

  "panel.swapTitle": "Invertir idiomas",
  "panel.openFileTitle": "Abrir archivo .txt/.md",
  "panel.openFile": "Abrir archivo",
  "panel.looksLike": "Parece {lang}.",
  "panel.swapTo": "Invertir a {dir}",
  "panel.modelMissingPre": "El modelo de",
  "panel.modelMissingPost": "aún no se ha descargado.",
  "panel.downloadNow": "Descargar ahora",
  "panel.sourcePlaceholder": "Escribe o pega el texto…  (Ctrl+Enter traduce)",
  "panel.translating": "Traduciendo…",
  "panel.resultPlaceholder": "Traducción",
  "panel.translate": "Traducir",
  "panel.clear": "limpiar",
  "panel.copy": "copiar",

  "toast.copied": "Traducción copiada",
  "toast.copyFailed": "No se pudo copiar",
  "toast.readFailed": "Error al leer el archivo",
  "toast.openFailed": "No se pudo abrir el archivo.",
  "toast.modelInstalled": "Modelo {leg} instalado",
  "toast.modelRemoved": "Modelo {leg} eliminado",
  "toast.downloadFailed": "Error al descargar {leg}: {error}",

  "settings.title": "Configuración",
  "settings.theme": "Tema",
  "settings.themeSystem": "Sistema",
  "settings.themeLight": "Claro",
  "settings.themeDark": "Oscuro",
  "settings.language": "Idioma",
  "settings.about":
    " — traductor offline (pt-BR · es · en), 100% local, sin nube. Motor Marian/OPUS-MT (Helsinki-NLP) en candle. Parte de la suite Local.",

  "history.title": "Historial",
  "history.clearAll": "borrar todo",
  "history.empty": "Nada traducido todavía.",
  "history.reopenTitle": "Reabrir esta traducción",
  "history.deleteTitle": "Eliminar",
  "time.now": "ahora",
  "time.min": "{n} min",
  "time.hour": "{n} h",

  "models.title": "Modelos de idioma",
  "models.sub":
    "Descarga solo los pares que uses. Portugués ↔ Español reutiliza los modelos vía inglés (no tiene descarga propia).",
  "models.installed": "instalado",
  "models.cancel": "cancelar",
  "models.remove": "eliminar",
  "models.download": "descargar",
  "models.foot1": "Los modelos se guardan en",
  "models.foot2":
    ". Permanecen en la RAM solo mientras se usan y se descargan tras unos minutos inactivos.",
};

const DICTS: Record<Locale, Record<MessageKey, string>> = { pt, en, es };

/** Palpite de locale pelo idioma do sistema (só no 1º uso). */
export function detectLocale(): Locale {
  const l = (typeof navigator !== "undefined" ? navigator.language : "pt").toLowerCase();
  if (l.startsWith("en")) return "en";
  if (l.startsWith("es")) return "es";
  return "pt";
}

function loadLocale(): Locale {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(LOCALE_KEY) : null;
  return v === "pt" || v === "en" || v === "es" ? v : detectLocale();
}

let current: Locale = loadLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale) {
  if (locale === current) return;
  current = locale;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* localStorage indisponível */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Inscreve o componente nas trocas de locale. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale);
}

/** Traduz uma chave, interpolando placeholders `{param}`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let msg: string = DICTS[current][key] ?? pt[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.split(`{${k}}`).join(String(v));
    }
  }
  return msg;
}
