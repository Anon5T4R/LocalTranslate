import { dirLabel } from "../lib/langs";
import { useStore } from "../state/store";

function when(ms: number): string {
  const d = new Date(ms);
  const now = Date.now();
  const diff = (now - ms) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString();
}

export function HistoryPanel() {
  const history = useStore((s) => s.history);
  const useEntry = useStore((s) => s.useEntry);
  const removeEntry = useStore((s) => s.removeEntry);
  const clearHistory = useStore((s) => s.clearHistory);

  return (
    <aside className="history">
      <div className="history-head">
        <h2>Histórico</h2>
        {history.length > 0 && (
          <button className="link" onClick={clearHistory}>
            limpar tudo
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="empty">Nada traduzido ainda.</p>
      ) : (
        <ul>
          {history.map((e) => (
            <li key={e.id} onClick={() => useEntry(e)} title="Reabrir esta tradução">
              <div className="h-meta">
                <span className="h-dir">{dirLabel(e.direction)}</span>
                <span className="h-when">{when(e.createdMs)}</span>
              </div>
              <div className="h-src">{e.source}</div>
              <div className="h-res">{e.result}</div>
              <button
                className="h-del"
                title="Excluir"
                onClick={(ev) => {
                  ev.stopPropagation();
                  removeEntry(e.id);
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
