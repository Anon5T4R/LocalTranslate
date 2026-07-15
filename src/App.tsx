import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { TranslatePanel } from "./components/TranslatePanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { ModelsModal } from "./components/ModelsModal";
import { SettingsModal } from "./components/SettingsModal";
import { Toasts } from "./components/Toasts";
import {
  inTauri,
  onDownloadDone,
  onDownloadProgress,
  onOpenFile,
  readTextFile,
} from "./lib/backend";
import { useStore } from "./state/store";
import { useUi } from "./state/ui";

export default function App() {
  const historyOpen = useUi((s) => s.historyOpen);
  const modelsOpen = useUi((s) => s.modelsOpen);
  const settingsOpen = useUi((s) => s.settingsOpen);
  const pushToast = useUi((s) => s.pushToast);

  const loadHistory = useStore((s) => s.loadHistory);
  const loadModels = useStore((s) => s.loadModels);
  const setProgress = useStore((s) => s.setProgress);
  const setSource = useStore((s) => s.setSource);

  useEffect(() => {
    loadHistory();
    loadModels();
    if (!inTauri()) return;

    const unlisteners: Promise<() => void>[] = [
      onDownloadProgress((p) => setProgress(p.leg, { received: p.received, total: p.total })),
      onDownloadDone((d) => {
        setProgress(d.leg, null);
        loadModels();
        if (d.ok) pushToast("ok", `Modelo ${d.leg} instalado`);
        else if (d.error && d.error !== "cancelado")
          pushToast("error", `Falha ao baixar ${d.leg}: ${d.error}`);
      }),
      onOpenFile(async (path) => {
        try {
          setSource(await readTextFile(path));
        } catch {
          pushToast("error", "Não consegui abrir o arquivo.");
        }
      }),
    ];
    return () => {
      unlisteners.forEach((p) => p.then((u) => u()));
    };
  }, [loadHistory, loadModels, setProgress, setSource, pushToast]);

  return (
    <div className="app">
      <TopBar />
      <div className="body">
        <TranslatePanel />
        {historyOpen && <HistoryPanel />}
      </div>
      {modelsOpen && <ModelsModal />}
      {settingsOpen && <SettingsModal />}
      <Toasts />
    </div>
  );
}
