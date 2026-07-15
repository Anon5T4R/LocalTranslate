import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { inTauri, readTextFile } from "../lib/backend";
import { detectLang } from "../lib/detect";
import { t } from "../lib/i18n";
import { LANGS, dirId, dirLabel, type Lang } from "../lib/langs";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";

function LangSelect({
  value,
  onChange,
  exclude,
}: {
  value: Lang;
  onChange: (l: Lang) => void;
  exclude: Lang;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Lang)}>
      {LANGS.map((l) => (
        <option key={l.code} value={l.code} disabled={l.code === exclude}>
          {l.flag} {l.name}
        </option>
      ))}
    </select>
  );
}

export function TranslatePanel() {
  const from = useStore((s) => s.from);
  const to = useStore((s) => s.to);
  const source = useStore((s) => s.source);
  const result = useStore((s) => s.result);
  const translating = useStore((s) => s.translating);
  const error = useStore((s) => s.error);
  const modelMissing = useStore((s) => s.modelMissing);

  const setFrom = useStore((s) => s.setFrom);
  const setTo = useStore((s) => s.setTo);
  const swap = useStore((s) => s.swap);
  const setSource = useStore((s) => s.setSource);
  const translate = useStore((s) => s.translate);

  const setModelsOpen = useUi((s) => s.setModelsOpen);
  const pushToast = useUi((s) => s.pushToast);

  const [detected, setDetected] = useState<Lang | null>(null);

  // Detecta o idioma da origem (heurística leve) e sugere trocar a direção.
  useEffect(() => {
    const t = setTimeout(() => setDetected(detectLang(source)), 250);
    return () => clearTimeout(t);
  }, [source]);

  const srcRef = useRef<HTMLTextAreaElement>(null);

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      translate();
    }
  };

  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      pushToast("ok", t("toast.copied"));
    } catch {
      pushToast("error", t("toast.copyFailed"));
    }
  };

  const openFile = async () => {
    if (!inTauri()) return;
    const path = await open({
      multiple: false,
      filters: [{ name: "Texto", extensions: ["txt", "md", "markdown"] }],
    });
    if (typeof path === "string") {
      try {
        setSource(await readTextFile(path));
      } catch {
        pushToast("error", t("toast.readFailed"));
      }
    }
  };

  const suggestSwap = detected && detected !== from && detected === to;

  return (
    <main className="translate">
      <div className="lang-bar">
        <LangSelect value={from} onChange={setFrom} exclude={to} />
        <button className="swap" onClick={swap} title={t("panel.swapTitle")}>
          ⇄
        </button>
        <LangSelect value={to} onChange={setTo} exclude={from} />
        <div className="spacer" />
        <button className="ghost" onClick={openFile} title={t("panel.openFileTitle")}>
          📄 {t("panel.openFile")}
        </button>
      </div>

      {suggestSwap && (
        <div className="hint">
          {t("panel.looksLike", { lang: LANGS.find((l) => l.code === detected)?.name ?? "" })}{" "}
          <button className="link" onClick={swap}>
            {t("panel.swapTo", { dir: dirLabel(dirId(to, from)) })}
          </button>
        </div>
      )}

      {modelMissing && (
        <div className="banner warn">
          {t("panel.modelMissingPre")} <strong>{dirLabel(modelMissing)}</strong>{" "}
          {t("panel.modelMissingPost")}{" "}
          <button className="link" onClick={() => setModelsOpen(true)}>
            {t("panel.downloadNow")}
          </button>
        </div>
      )}
      {error && <div className="banner err">{error}</div>}

      <div className="boxes">
        <div className="box">
          <div className="box-head">
            <span>{LANGS.find((l) => l.code === from)?.name}</span>
            <div className="box-actions">
              <span className="count">{source.length}</span>
              {source && (
                <button className="link" onClick={() => setSource("")}>
                  {t("panel.clear")}
                </button>
              )}
            </div>
          </div>
          <textarea
            ref={srcRef}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onKeyDown={onKey}
            placeholder={t("panel.sourcePlaceholder")}
            autoFocus
          />
        </div>

        <div className="box">
          <div className="box-head">
            <span>{LANGS.find((l) => l.code === to)?.name}</span>
            <div className="box-actions">
              {result && (
                <button className="link" onClick={copyResult}>
                  {t("panel.copy")}
                </button>
              )}
            </div>
          </div>
          <textarea
            value={translating ? "" : result}
            readOnly
            placeholder={translating ? t("panel.translating") : t("panel.resultPlaceholder")}
            className={translating ? "loading" : ""}
          />
        </div>
      </div>

      <div className="run">
        <button className="primary" onClick={translate} disabled={translating || !source.trim()}>
          {translating ? t("panel.translating") : t("panel.translate")}
        </button>
      </div>
    </main>
  );
}
