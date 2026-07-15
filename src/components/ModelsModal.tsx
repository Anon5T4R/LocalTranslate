import { cancelDownload, downloadModel, fmtBytes, removeModel } from "../lib/backend";
import { t } from "../lib/i18n";
import { dirLabel } from "../lib/langs";
import type { LegStatus } from "../lib/types";
import { useStore } from "../state/store";
import { useUi } from "../state/ui";

export function ModelsModal() {
  const setModelsOpen = useUi((s) => s.setModelsOpen);
  const pushToast = useUi((s) => s.pushToast);
  const models = useStore((s) => s.models);
  const progress = useStore((s) => s.progress);
  const loadModels = useStore((s) => s.loadModels);

  // Os modelos em disco são as 4 pernas base; pt↔es reusa en-pt/pt-en/en-es/es-en.
  const legMap = new Map<string, LegStatus>();
  for (const d of models) for (const l of d.legs) legMap.set(l.leg, l);
  const legs = [...legMap.values()].sort((a, b) => a.leg.localeCompare(b.leg));

  const startDownload = async (leg: string) => {
    try {
      await downloadModel(leg);
    } catch (e) {
      pushToast("error", String(e));
    }
  };
  const stopDownload = (leg: string) => cancelDownload(leg).catch(() => {});
  const doRemove = async (leg: string) => {
    try {
      await removeModel(leg);
      await loadModels();
      pushToast("info", t("toast.modelRemoved", { leg }));
    } catch (e) {
      pushToast("error", String(e));
    }
  };

  return (
    <div className="overlay" onClick={() => setModelsOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{t("models.title")}</h2>
          <button className="close" onClick={() => setModelsOpen(false)}>
            ✕
          </button>
        </div>
        <p className="modal-sub">{t("models.sub")}</p>
        <ul className="model-list">
          {legs.map((l) => {
            const p = progress[l.leg];
            const downloading = l.downloading || !!p;
            const pct = p && p.total > 0 ? Math.round((p.received / p.total) * 100) : 0;
            return (
              <li key={l.leg}>
                <div className="m-info">
                  <span className="m-name">{dirLabel(l.leg)}</span>
                  <span className="m-size">
                    {l.installed ? t("models.installed") : fmtBytes(l.bytes)}
                  </span>
                </div>
                {downloading ? (
                  <div className="m-dl">
                    <div className="progress">
                      <div className="bar" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="m-pct">
                      {p ? `${fmtBytes(p.received)} / ${fmtBytes(p.total)}` : "…"}
                    </span>
                    <button className="ghost" onClick={() => stopDownload(l.leg)}>
                      {t("models.cancel")}
                    </button>
                  </div>
                ) : l.installed ? (
                  <button className="ghost danger" onClick={() => doRemove(l.leg)}>
                    {t("models.remove")}
                  </button>
                ) : (
                  <button className="primary sm" onClick={() => startDownload(l.leg)}>
                    {t("models.download")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="modal-foot">
          {t("models.foot1")} <code>app_data/translate/models</code>
          {t("models.foot2")}
        </p>
      </div>
    </div>
  );
}
