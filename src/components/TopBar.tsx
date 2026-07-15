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
          title="Histórico de traduções"
        >
          🕘 Histórico
        </button>
        <button onClick={() => setModelsOpen(true)} title="Gerenciar modelos de idioma">
          {anyInstalled ? "📦 Modelos" : "📥 Modelos"}
        </button>
        <button onClick={() => setSettingsOpen(true)} title="Configurações">
          ⚙️
        </button>
      </div>
    </header>
  );
}
