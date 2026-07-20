// Janelinha do atalho global: abre com o que está na área de transferência,
// traduz, copia e some. Entry point próprio (`quick.html`) — ver vite.config.ts.

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
import "./quick.css";
import {
  clipboardWrite,
  inTauri,
  onQuickBlur,
  onQuickOpen,
  quickConfig,
  quickConfigSet,
  quickHide,
  translateText,
} from "./lib/backend";
import { t, useLocale } from "./lib/i18n";
import { LANGS, dirId, type Lang } from "./lib/langs";
import { applyTheme, useUi } from "./state/ui";
import type { QuickConfig } from "./lib/types";

applyTheme(useUi.getState().theme);

function Quick() {
  const [cfg, setCfg] = useState<QuickConfig | null>(null);
  const [source, setSource] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  // O `Focused(false)` chega uma vez logo depois do `show()` em algumas
  // máquinas; sem esta carência a janela abriria e sumiria no mesmo instante.
  const openedAt = useRef(0);
  // Ref (e não estado): o listener de blur é montado uma vez só e leria
  // sempre o valor do primeiro render.
  const hideOnBlurRef = useRef(true);

  const close = useCallback(() => {
    void quickHide().catch(() => {});
  }, []);

  const [from, to] = (cfg?.direction ?? "en-pt").split("-") as [Lang, Lang];

  const setDirection = (direction: string) => {
    if (!cfg) return;
    const next = { ...cfg, direction };
    setCfg(next);
    void quickConfigSet(next).catch(() => {});
    setResult("");
  };

  useEffect(() => {
    void quickConfig()
      .then(setCfg)
      .catch(() =>
        setCfg({
          shortcut: "",
          enabled: false,
          direction: "en-pt",
          hideOnBlur: true,
          keepInTray: false,
        }),
      );
  }, []);

  useEffect(() => {
    if (!inTauri()) return;
    const uns = [
      onQuickOpen((clip) => {
        openedAt.current = Date.now();
        setSource(clip ?? "");
        setResult("");
        setError(null);
        setCopied(false);
        setTimeout(() => {
          ref.current?.focus();
          ref.current?.select();
        }, 30);
      }),
      onQuickBlur(() => {
        if (Date.now() - openedAt.current < 400) return;
        if (hideOnBlurRef.current) close();
      }),
    ];
    return () => {
      uns.forEach((p) => void p.then((u) => u()));
    };
  }, [close]);

  useEffect(() => {
    hideOnBlurRef.current = cfg?.hideOnBlur ?? true;
  }, [cfg]);

  const run = useCallback(async () => {
    const text = source.trim();
    if (!text || busy || !cfg) return;
    setBusy(true);
    setError(null);
    try {
      const out = await translateText(cfg.direction, source);
      setResult(out);
    } catch (e) {
      const msg = typeof e === "string" ? e : String((e as Error)?.message ?? e);
      setError(msg.includes("MODEL_MISSING") ? t("quick.modelMissing") : msg);
    } finally {
      setBusy(false);
    }
  }, [source, busy, cfg]);

  const copyAndClose = useCallback(async () => {
    if (!result) return;
    try {
      await clipboardWrite(result);
      setCopied(true);
      close();
    } catch {
      setError(t("toast.copyFailed"));
    }
  }, [result, close]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (result) void copyAndClose();
        else void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, run, copyAndClose, result]);

  return (
    <div className="quick">
      <div className="quick-head" data-tauri-drag-region>
        <select
          value={dirId(from, to)}
          onChange={(e) => setDirection(e.target.value)}
          aria-label={t("quick.direction")}
        >
          {LANGS.flatMap((a) =>
            LANGS.filter((b) => b.code !== a.code).map((b) => (
              <option key={dirId(a.code, b.code)} value={dirId(a.code, b.code)}>
                {a.flag} {a.name} → {b.flag} {b.name}
              </option>
            )),
          )}
        </select>
        <div className="spacer" />
        <span className="quick-hint">{t("quick.hint")}</span>
        <button className="close" onClick={close} title={t("quick.close")}>
          ✕
        </button>
      </div>

      {error && <div className="banner err">{error}</div>}

      <textarea
        ref={ref}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder={t("quick.placeholder")}
        autoFocus
      />

      <div className="quick-result">
        {busy ? <span className="muted">{t("panel.translating")}</span> : result || ""}
      </div>

      <div className="quick-foot">
        <button className="primary" onClick={run} disabled={busy || !source.trim()}>
          {busy ? t("panel.translating") : t("panel.translate")}
        </button>
        <button className="ghost" onClick={copyAndClose} disabled={!result}>
          {copied ? t("toast.copied") : t("quick.copyClose")}
        </button>
      </div>
    </div>
  );
}

function Root() {
  const locale = useLocale();
  return <Quick key={locale} />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
