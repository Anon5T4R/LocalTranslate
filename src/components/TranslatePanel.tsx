import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { inTauri, readTextFile } from "../lib/backend";
import { detectLang } from "../lib/detect";
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
      pushToast("ok", "Tradução copiada");
    } catch {
      pushToast("error", "Não consegui copiar");
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
        pushToast("error", "Falha ao ler o arquivo");
      }
    }
  };

  const suggestSwap = detected && detected !== from && detected === to;

  return (
    <main className="translate">
      <div className="lang-bar">
        <LangSelect value={from} onChange={setFrom} exclude={to} />
        <button className="swap" onClick={swap} title="Inverter idiomas">
          ⇄
        </button>
        <LangSelect value={to} onChange={setTo} exclude={from} />
        <div className="spacer" />
        <button className="ghost" onClick={openFile} title="Abrir arquivo .txt/.md">
          📄 Abrir arquivo
        </button>
      </div>

      {suggestSwap && (
        <div className="hint">
          Parece {LANGS.find((l) => l.code === detected)?.name}. {" "}
          <button className="link" onClick={swap}>
            Inverter para {dirLabel(dirId(to, from))}
          </button>
        </div>
      )}

      {modelMissing && (
        <div className="banner warn">
          O modelo para <strong>{dirLabel(modelMissing)}</strong> ainda não foi baixado.{" "}
          <button className="link" onClick={() => setModelsOpen(true)}>
            Baixar agora
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
                  limpar
                </button>
              )}
            </div>
          </div>
          <textarea
            ref={srcRef}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onKeyDown={onKey}
            placeholder="Digite ou cole o texto…  (Ctrl+Enter traduz)"
            autoFocus
          />
        </div>

        <div className="box">
          <div className="box-head">
            <span>{LANGS.find((l) => l.code === to)?.name}</span>
            <div className="box-actions">
              {result && (
                <button className="link" onClick={copyResult}>
                  copiar
                </button>
              )}
            </div>
          </div>
          <textarea
            value={translating ? "" : result}
            readOnly
            placeholder={translating ? "Traduzindo…" : "Tradução"}
            className={translating ? "loading" : ""}
          />
        </div>
      </div>

      <div className="run">
        <button className="primary" onClick={translate} disabled={translating || !source.trim()}>
          {translating ? "Traduzindo…" : "Traduzir"}
        </button>
      </div>
    </main>
  );
}
