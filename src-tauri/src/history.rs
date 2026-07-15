//! Histórico local de traduções — um SQLite único em `app_data/translate.db`
//! (tradução não é "arquivo"; o histórico é do app, não de um documento).

use rusqlite::Connection;
use serde::Serialize;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

/// Conexão única protegida por Mutex (zero escrita concorrente no arquivo).
#[derive(Default)]
pub struct Db(pub Mutex<Option<Connection>>);

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: i64,
    pub created_ms: i64,
    pub direction: String,
    pub source: String,
    pub result: String,
}

/// Abre (e cria/migra) o banco em app_data.
pub fn open(app: &AppHandle, db: &Db) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(dir.join("translate.db")).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS history (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            created_ms INTEGER NOT NULL,
            direction  TEXT NOT NULL,
            source     TEXT NOT NULL,
            result     TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_ms DESC);",
    )
    .map_err(|e| e.to_string())?;
    *db.0.lock().unwrap() = Some(conn);
    Ok(())
}

fn with_conn<T>(db: &Db, f: impl FnOnce(&Connection) -> rusqlite::Result<T>) -> Result<T, String> {
    let guard = db.0.lock().unwrap();
    let conn = guard.as_ref().ok_or("banco não aberto")?;
    f(conn).map_err(|e| e.to_string())
}

/// Guarda uma tradução e devolve a entrada criada (com id). Ignora textos vazios
/// e evita duplicar a última entrada idêntica (traduzir o mesmo texto de novo).
#[tauri::command(async)]
pub fn history_add(
    db: State<'_, Db>,
    direction: String,
    source: String,
    result: String,
) -> Result<Option<Entry>, String> {
    if source.trim().is_empty() || result.trim().is_empty() {
        return Ok(None);
    }
    with_conn(&db, |conn| {
        let dup: Option<i64> = conn
            .query_row(
                "SELECT id FROM history ORDER BY created_ms DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .ok()
            .filter(|&last: &i64| {
                conn.query_row(
                    "SELECT 1 FROM history WHERE id=?1 AND direction=?2 AND source=?3 AND result=?4",
                    rusqlite::params![last, direction, source, result],
                    |_| Ok(()),
                )
                .is_ok()
            });
        if let Some(id) = dup {
            let created_ms = now_ms();
            conn.execute("UPDATE history SET created_ms=?1 WHERE id=?2", rusqlite::params![created_ms, id])?;
            return Ok(Some(Entry { id, created_ms, direction, source, result }));
        }
        let created_ms = now_ms();
        conn.execute(
            "INSERT INTO history (created_ms, direction, source, result) VALUES (?1,?2,?3,?4)",
            rusqlite::params![created_ms, direction, source, result],
        )?;
        let id = conn.last_insert_rowid();
        // retenção: guarda as 500 mais recentes
        conn.execute(
            "DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY created_ms DESC LIMIT 500)",
            [],
        )?;
        Ok(Some(Entry { id, created_ms, direction, source, result }))
    })
}

#[tauri::command(async)]
pub fn history_list(db: State<'_, Db>) -> Result<Vec<Entry>, String> {
    with_conn(&db, |conn| {
        let mut stmt = conn.prepare(
            "SELECT id, created_ms, direction, source, result
             FROM history ORDER BY created_ms DESC LIMIT 500",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(Entry {
                id: r.get(0)?,
                created_ms: r.get(1)?,
                direction: r.get(2)?,
                source: r.get(3)?,
                result: r.get(4)?,
            })
        })?;
        rows.collect()
    })
}

#[tauri::command(async)]
pub fn history_delete(db: State<'_, Db>, id: i64) -> Result<(), String> {
    with_conn(&db, |conn| {
        conn.execute("DELETE FROM history WHERE id=?1", [id])?;
        Ok(())
    })
}

#[tauri::command(async)]
pub fn history_clear(db: State<'_, Db>) -> Result<(), String> {
    with_conn(&db, |conn| {
        conn.execute("DELETE FROM history", [])?;
        Ok(())
    })
}
