import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { TranslatePanel } from "./components/TranslatePanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { ModelsModal } from "./components/ModelsModal";
import { SettingsModal } from "./components/SettingsModal";
import { FileModal } from "./components/FileModal";
import { Toasts } from "./components/Toasts";
import {
  inTauri,
  onDownloadDone,
  onDownloadProgress,
  onOpenFile,
  readTextFile,
} from "./lib/backend";
import { t } from "./lib/i18n";
import { useStore } from "./state/store";
import { useUi } from "./state/ui";

export default function App() {
  const historyOpen = useUi((s) => s.historyOpen);
  const modelsOpen = useUi((s) => s.modelsOpen);
  const settingsOpen = useUi((s) => s.settingsOpen);
  const fileOpen = useUi((s) => s.fileOpen);
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
        if (d.ok) pushToast("ok", t("toast.modelInstalled", { leg: d.leg }));
        else if (d.error && d.error !== "cancelado")
          pushToast("error", t("toast.downloadFailed", { leg: d.leg, error: d.error }));
      }),
      onOpenFile(async (path) => {
        try {
          setSource(await readTextFile(path));
        } catch {
          pushToast("error", t("toast.openFailed"));
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
      {fileOpen && <FileModal />}
      <Toasts />
    </div>
  );
}
