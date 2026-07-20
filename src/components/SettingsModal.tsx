import { useEffect, useState } from "react";
import { quickConfig, quickConfigSet } from "../lib/backend";
import { LOCALE_LABELS, type Locale, setLocale, t, useLocale } from "../lib/i18n";
import type { QuickConfig } from "../lib/types";
import { type Theme, useUi } from "../state/ui";

const THEMES: {
  value: Theme;
  labelKey:
    | "settings.themeSystem"
    | "settings.themeLight"
    | "settings.themeDark"
    | "settings.themeNature"
    | "settings.themeDarkblue"
    | "settings.themeCalmgreen"
    | "settings.themePastelpink"
    | "settings.themePunkprincess";
}[] = [
  { value: "system", labelKey: "settings.themeSystem" },
  { value: "light", labelKey: "settings.themeLight" },
  { value: "dark", labelKey: "settings.themeDark" },
  { value: "nature", labelKey: "settings.themeNature" },
  { value: "darkblue", labelKey: "settings.themeDarkblue" },
  { value: "calmgreen", labelKey: "settings.themeCalmgreen" },
  { value: "pastelpink", labelKey: "settings.themePastelpink" },
  { value: "punkprincess", labelKey: "settings.themePunkprincess" },
];

const LOCALES: Locale[] = ["pt", "en", "es"];

export function SettingsModal() {
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const locale = useLocale();

  const [quick, setQuick] = useState<QuickConfig | null>(null);
  const [shortcutErr, setShortcutErr] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    void quickConfig()
      .then(setQuick)
      .catch(() => {});
  }, []);

  // O registro é a única prova: `register()` devolve Err quando a combinação já
  // é de outro app. Sem mostrar isso, o usuário aperta a tecla, não acontece
  // nada, e o app parece quebrado.
  const applyQuick = async (next: QuickConfig) => {
    setQuick(next);
    setSavedOk(false);
    try {
      await quickConfigSet(next);
      setShortcutErr(null);
      setSavedOk(true);
    } catch (e) {
      const msg = typeof e === "string" ? e : String((e as Error)?.message ?? e);
      setShortcutErr(
        msg.includes("SHORTCUT_BUSY")
          ? t("settings.quickBusy", { accel: next.shortcut })
          : msg,
      );
    }
  };

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

        {quick && (
          <div className="setting">
            <label>{t("settings.quick")}</label>
            <p className="modal-sub">{t("settings.quickHelp")}</p>
            <label className="check">
              <input
                type="checkbox"
                checked={quick.enabled}
                onChange={(e) => void applyQuick({ ...quick, enabled: e.target.checked })}
              />
              {t("settings.quickEnabled")}
            </label>
            <div className="row">
              <input
                type="text"
                value={quick.shortcut}
                spellCheck={false}
                onChange={(e) => setQuick({ ...quick, shortcut: e.target.value })}
                onBlur={() => void applyQuick(quick)}
                placeholder="ctrl+shift+t"
                disabled={!quick.enabled}
              />
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={quick.hideOnBlur}
                onChange={(e) => void applyQuick({ ...quick, hideOnBlur: e.target.checked })}
              />
              {t("settings.quickHideOnBlur")}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={quick.keepInTray}
                onChange={(e) => void applyQuick({ ...quick, keepInTray: e.target.checked })}
              />
              {t("settings.quickKeepTray")}
            </label>
            {shortcutErr && <div className="banner err">{shortcutErr}</div>}
            {savedOk && !shortcutErr && <div className="banner ok">{t("settings.quickSaved")}</div>}
          </div>
        )}

        <p className="modal-foot">
          <strong>LocalTranslate</strong>{t("settings.about")}
        </p>
      </div>
    </div>
  );
}
