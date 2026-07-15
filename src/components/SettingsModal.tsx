import { LOCALE_LABELS, type Locale, setLocale, t, useLocale } from "../lib/i18n";
import { type Theme, useUi } from "../state/ui";

const THEMES: { value: Theme; labelKey: "settings.themeSystem" | "settings.themeLight" | "settings.themeDark" }[] = [
  { value: "system", labelKey: "settings.themeSystem" },
  { value: "light", labelKey: "settings.themeLight" },
  { value: "dark", labelKey: "settings.themeDark" },
];

const LOCALES: Locale[] = ["pt", "en", "es"];

export function SettingsModal() {
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const locale = useLocale();

  return (
    <div className="overlay" onClick={() => setSettingsOpen(false)}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{t("settings.title")}</h2>
          <button className="close" onClick={() => setSettingsOpen(false)}>
            ✕
          </button>
        </div>

        <div className="setting">
          <label>{t("settings.language")}</label>
          <div className="seg">
            {LOCALES.map((l) => (
              <button
                key={l}
                className={locale === l ? "active" : ""}
                onClick={() => setLocale(l)}
              >
                {LOCALE_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        <div className="setting">
          <label>{t("settings.theme")}</label>
          <div className="seg">
            {THEMES.map((opt) => (
              <button
                key={opt.value}
                className={theme === opt.value ? "active" : ""}
                onClick={() => setTheme(opt.value)}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <p className="modal-foot">
          <strong>LocalTranslate</strong>{t("settings.about")}
        </p>
      </div>
    </div>
  );
}
