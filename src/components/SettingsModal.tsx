import { type Theme, useUi } from "../state/ui";

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

export function SettingsModal() {
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);

  return (
    <div className="overlay" onClick={() => setSettingsOpen(false)}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Configurações</h2>
          <button className="close" onClick={() => setSettingsOpen(false)}>
            ✕
          </button>
        </div>

        <div className="setting">
          <label>Tema</label>
          <div className="seg">
            {THEMES.map((t) => (
              <button
                key={t.value}
                className={theme === t.value ? "active" : ""}
                onClick={() => setTheme(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <p className="modal-foot">
          <strong>LocalTranslate</strong> — tradutor offline (pt-BR · es · en), 100%
          local, sem nuvem. Motor Marian/OPUS-MT (Helsinki-NLP) no candle. Parte da
          suíte Local.
        </p>
      </div>
    </div>
  );
}
