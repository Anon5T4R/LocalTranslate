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
  "settings.themeNature": "Natureza",
  "settings.themeDarkblue": "Azul escuro",
  "settings.themeCalmgreen": "Verde calmo",
  "settings.themePastelpink": "Rosa pastel",
  "settings.themePunkprincess": "PunkPrincess",
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

  // Arquivo (.txt/.md)
  "topbar.fileTitle": "Traduzir um arquivo .txt ou .md inteiro",
  "topbar.file": "Arquivo",
  "file.title": "Traduzir arquivo",
  "file.sub":
    "Traduz um .txt ou .md inteiro e salva numa cópia. Em Markdown a estrutura é preservada: cabeçalhos, listas, links, tabelas, blocos de código e trechos `assim` saem intactos.",
  "file.pick": "Escolher arquivo",
  "file.units": "{n} trechos a traduzir",
  "file.direction": "Direção:",
  "file.directionNote": "(muda na tela principal)",
  "file.mdNote":
    "Markdown detectado — só o texto vai pro modelo. URLs, código e marcadores não são traduzidos.",
  "file.run": "Traduzir e salvar…",
  "file.cancel": "Cancelar",
  "file.canceled": "Tradução cancelada.",
  "file.progress": "{done} de {total} trechos",
  "file.etaSec": "faltam ~{n}s",
  "file.etaMin": "faltam ~{n} min",
  "file.saved": "Arquivo traduzido e salvo",
  "file.savedAt": "Salvo em",
  "file.modelMissing": "O modelo desta direção ainda não foi baixado.",

  // Janela rápida (atalho global)
  "quick.direction": "Direção da tradução",
  "quick.hint": "Ctrl+Enter traduz · Esc fecha",
  "quick.close": "Fechar",
  "quick.placeholder": "Cole ou digite o texto…",
  "quick.copyClose": "Copiar e fechar",
  "quick.modelMissing": "Modelo não baixado — abra o LocalTranslate para instalar.",
  "settings.quick": "Tradução rápida (atalho global)",
  "settings.quickHelp":
    "Com o app aberto (ou na bandeja), o atalho abre uma janelinha já com o texto da área de transferência.",
  "settings.quickEnabled": "Ligar o atalho global",
  "settings.quickHideOnBlur": "Fechar a janelinha ao clicar fora",
  "settings.quickBusy": "O sistema recusou \"{accel}\" — provavelmente já é atalho de outro app.",
  "settings.quickKeepTray": "Fechar a janela mantém o app na bandeja (atalho segue valendo)",
  "settings.quickSaved": "Atalho registrado.",
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
  "settings.themeNature": "Nature",
  "settings.themeDarkblue": "Dark blue",
  "settings.themeCalmgreen": "Calm green",
  "settings.themePastelpink": "Pastel pink",
  "settings.themePunkprincess": "PunkPrincess",
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

  "topbar.fileTitle": "Translate a whole .txt or .md file",
  "topbar.file": "File",
  "file.title": "Translate file",
  "file.sub":
    "Translates a whole .txt or .md and saves a copy. In Markdown the structure is preserved: headings, lists, links, tables, code blocks and `inline` snippets come out untouched.",
  "file.pick": "Choose file",
  "file.units": "{n} segments to translate",
  "file.direction": "Direction:",
  "file.directionNote": "(change it on the main screen)",
  "file.mdNote":
    "Markdown detected — only the prose goes to the model. URLs, code and markers are not translated.",
  "file.run": "Translate and save…",
  "file.cancel": "Cancel",
  "file.canceled": "Translation canceled.",
  "file.progress": "{done} of {total} segments",
  "file.etaSec": "~{n}s left",
  "file.etaMin": "~{n} min left",
  "file.saved": "File translated and saved",
  "file.savedAt": "Saved to",
  "file.modelMissing": "The model for this direction hasn't been downloaded yet.",

  "quick.direction": "Translation direction",
  "quick.hint": "Ctrl+Enter translates · Esc closes",
  "quick.close": "Close",
  "quick.placeholder": "Paste or type the text…",
  "quick.copyClose": "Copy and close",
  "quick.modelMissing": "Model not downloaded — open LocalTranslate to install it.",
  "settings.quick": "Quick translate (global shortcut)",
  "settings.quickHelp":
    "With the app open (or in the tray), the shortcut opens a small window already filled with the clipboard text.",
  "settings.quickEnabled": "Enable the global shortcut",
  "settings.quickHideOnBlur": "Close the small window when clicking outside",
  "settings.quickBusy": "The system refused \"{accel}\" — another app probably owns it.",
  "settings.quickKeepTray": "Closing the window keeps the app in the tray (shortcut stays live)",
  "settings.quickSaved": "Shortcut registered.",
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
  "settings.themeNature": "Naturaleza",
  "settings.themeDarkblue": "Azul oscuro",
  "settings.themeCalmgreen": "Verde tranquilo",
  "settings.themePastelpink": "Rosa pastel",
  "settings.themePunkprincess": "PunkPrincess",
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

  "topbar.fileTitle": "Traducir un archivo .txt o .md completo",
  "topbar.file": "Archivo",
  "file.title": "Traducir archivo",
  "file.sub":
    "Traduce un .txt o .md completo y guarda una copia. En Markdown se conserva la estructura: encabezados, listas, enlaces, tablas, bloques de código y fragmentos `así` salen intactos.",
  "file.pick": "Elegir archivo",
  "file.units": "{n} fragmentos por traducir",
  "file.direction": "Dirección:",
  "file.directionNote": "(se cambia en la pantalla principal)",
  "file.mdNote":
    "Markdown detectado — solo el texto va al modelo. Las URL, el código y los marcadores no se traducen.",
  "file.run": "Traducir y guardar…",
  "file.cancel": "Cancelar",
  "file.canceled": "Traducción cancelada.",
  "file.progress": "{done} de {total} fragmentos",
  "file.etaSec": "faltan ~{n}s",
  "file.etaMin": "faltan ~{n} min",
  "file.saved": "Archivo traducido y guardado",
  "file.savedAt": "Guardado en",
  "file.modelMissing": "El modelo de esta dirección aún no se ha descargado.",

  "quick.direction": "Dirección de la traducción",
  "quick.hint": "Ctrl+Enter traduce · Esc cierra",
  "quick.close": "Cerrar",
  "quick.placeholder": "Pega o escribe el texto…",
  "quick.copyClose": "Copiar y cerrar",
  "quick.modelMissing": "Modelo no descargado — abre LocalTranslate para instalarlo.",
  "settings.quick": "Traducción rápida (atajo global)",
  "settings.quickHelp":
    "Con la app abierta (o en la bandeja), el atajo abre una ventanita ya con el texto del portapapeles.",
  "settings.quickEnabled": "Activar el atajo global",
  "settings.quickHideOnBlur": "Cerrar la ventanita al hacer clic fuera",
  "settings.quickBusy": "El sistema rechazó \"{accel}\" — probablemente ya es atajo de otra app.",
  "settings.quickKeepTray": "Cerrar la ventana mantiene la app en la bandeja (el atajo sigue activo)",
  "settings.quickSaved": "Atajo registrado.",
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
