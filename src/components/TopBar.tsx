import { t } from "../lib/i18n";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";

export function TopBar() {
  const toggleHistory = useUi((s) => s.toggleHistory);
  const historyOpen = useUi((s) => s.historyOpen);
  const setModelsOpen = useUi((s) => s.setModelsOpen);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const models = useStore((s) => s.models);

  const anyInstalled = models.some((m) => m.installed);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden>🌐</span>
        <span className="brand-name">LocalTranslate</span>
      </div>
      <div className="topbar-actions">
        <button
          className={historyOpen ? "active" : ""}
          onClick={toggleHistory}
          title={t("topbar.historyTitle")}
        >
          🕘 {t("topbar.history")}
        </button>
        <button onClick={() => setModelsOpen(true)} title={t("topbar.modelsTitle")}>
          {anyInstalled ? "📦" : "📥"} {t("topbar.models")}
        </button>
        <button onClick={() => setSettingsOpen(true)} title={t("topbar.settingsTitle")}>
          ⚙️
        </button>
      </div>
    </header>
  );
}
