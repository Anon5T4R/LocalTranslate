// Traduzir um arquivo .txt/.md inteiro preservando a estrutura.
//
// A tradução roda no back (comando `async` = thread pool do Tauri), então a
// janela segue viva: barra de progresso por trecho e botão de cancelar. Isso
// não é luxo — arquivo grande leva MINUTOS num modelo Marian em CPU, e sem
// progresso o app pareceria travado.

import { useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  cancelDocument,
  documentUnits,
  inTauri,
  onDocProgress,
  readTextFile,
  translateDocument,
  writeTextFile,
} from "../lib/backend";
import { isMd, suggestOut } from "../lib/docfile";
import { t } from "../lib/i18n";
import { dirId } from "../lib/langs";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";

export function FileModal() {
  const setFileOpen = useUi((s) => s.setFileOpen);
  const pushToast = useUi((s) => s.pushToast);
  const setModelsOpen = useUi((s) => s.setModelsOpen);
  const from = useStore((s) => s.from);
  const to = useStore((s) => s.to);

  const [path, setPath] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [units, setUnits] = useState(0);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const md = path ? isMd(path) : false;

  useEffect(() => {
    if (!inTauri()) return;
    const un = onDocProgress(setProgress);
    return () => void un.then((u) => u());
  }, []);

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [running]);

  const pick = async () => {
    const p = await open({
      multiple: false,
      filters: [{ name: "Texto", extensions: ["txt", "md", "markdown", "mdown"] }],
    });
    if (typeof p !== "string") return;
    setError(null);
    setSavedTo(null);
    setProgress({ done: 0, total: 0 });
    try {
      const content = await readTextFile(p);
      setPath(p);
      setText(content);
      setUnits(await documentUnits(content, isMd(p)));
    } catch (e) {
      setError(String(e));
    }
  };

  const run = async () => {
    if (!path || running) return;
    const out = await save({
      defaultPath: suggestOut(path, to),
      filters: [{ name: "Texto", extensions: [md ? "md" : "txt"] }],
    });
    if (typeof out !== "string") return;
    setRunning(true);
    setError(null);
    setSavedTo(null);
    setElapsed(0);
    try {
      const translated = await translateDocument(dirId(from, to), text, md);
      await writeTextFile(out, translated);
      setSavedTo(out);
      pushToast("ok", t("file.saved"));
    } catch (e) {
      const msg = typeof e === "string" ? e : String((e as Error)?.message ?? e);
      if (msg.includes("MODEL_MISSING")) {
        setError(t("file.modelMissing"));
      } else if (msg.includes("cancelado")) {
        setError(t("file.canceled"));
      } else {
        setError(msg);
      }
    } finally {
      setRunning(false);
    }
  };

  const pct = useMemo(
    () => (progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0),
    [progress],
  );

  // Estimativa de tempo pelo ritmo já medido (só depois de algum progresso —
  // extrapolar de 2 trechos daria número inventado).
  const eta = useMemo(() => {
    if (!running || progress.done < 5 || elapsed < 3) return null;
    const rest = ((progress.total - progress.done) * elapsed) / progress.done;
    return rest > 90 ? t("file.etaMin", { n: Math.ceil(rest / 60) }) : t("file.etaSec", { n: Math.ceil(rest) });
  }, [running, progress, elapsed]);

  return (
    <div className="overlay" onClick={() => !running && setFileOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{t("file.title")}</h2>
          <button className="close" onClick={() => setFileOpen(false)} disabled={running}>
            ✕
          </button>
        </div>

        <p className="modal-sub">{t("file.sub")}</p>

        <div className="setting">
          <button className="ghost" onClick={pick} disabled={running}>
            📄 {t("file.pick")}
          </button>
          {path && (
            <span className="count">
              {path} · {md ? "Markdown" : "texto"} · {t("file.units", { n: units })}
            </span>
          )}
        </div>

        {path && (
          <p className="modal-sub">
            {t("file.direction")} <strong>{from.toUpperCase()} → {to.toUpperCase()}</strong>{" "}
            {t("file.directionNote")}
          </p>
        )}

        {md && <div className="banner warn">{t("file.mdNote")}</div>}

        {running && (
          <>
            <div className="progress">
              <div className="bar" style={{ width: `${pct}%` }} />
            </div>
            <p className="modal-sub">
              {t("file.progress", { done: progress.done, total: progress.total })} · {pct}%
              {eta ? ` · ${eta}` : ""}
            </p>
          </>
        )}

        {error && (
          <div className="banner err">
            {error}{" "}
            {error === t("file.modelMissing") && (
              <button className="link" onClick={() => setModelsOpen(true)}>
                {t("panel.downloadNow")}
              </button>
            )}
          </div>
        )}
        {savedTo && <div className="banner ok">{t("file.savedAt")} {savedTo}</div>}

        <div className="run">
          {running ? (
            <button className="ghost" onClick={() => void cancelDocument()}>
              {t("file.cancel")}
            </button>
          ) : (
            <button className="primary" onClick={run} disabled={!path || units === 0}>
              {t("file.run")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
