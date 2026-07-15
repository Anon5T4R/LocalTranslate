mod history;
mod translate;

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use history::Db;
use translate::{DirectionStatus, Translator};

/// Pasta de dados do app (onde ficam os modelos e o histórico).
fn app_data(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

/// Caminho passado no launch (abrir um `.txt`/`.md` pelo "Abrir com"), se houver.
#[tauri::command(async)]
fn get_startup_file() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| !a.starts_with('-') && Path::new(a).is_file())
}

/// Lê um arquivo de texto (traduzir arquivo `.txt`/`.md`).
#[tauri::command(async)]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Falha ao ler '{}': {}", path, e))
}

/// Grava texto direto (salvar tradução).
#[tauri::command(async)]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }
    std::fs::write(&path, content).map_err(|e| format!("Falha ao salvar '{}': {}", path, e))
}

// --- modelos ---

/// Estado de todas as 6 direções (instalado/baixando/tamanho).
#[tauri::command(async)]
fn models_status(app: AppHandle, tr: State<'_, Translator>) -> Result<Vec<DirectionStatus>, String> {
    Ok(translate::all_status(&app_data(&app)?, &tr))
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    leg: String,
    received: u64,
    total: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadDone {
    leg: String,
    ok: bool,
    error: Option<String>,
}

/// Baixa o modelo de uma perna numa thread; progresso e término via eventos
/// (`download-progress` / `download-done`). Devolve erro na hora só se já houver
/// um download dessa perna em andamento.
#[tauri::command(async)]
fn download_model(app: AppHandle, tr: State<'_, Translator>, leg: String) -> Result<(), String> {
    // O download é sempre por perna ("en-pt", "pt-en"…); a UI chama por perna.
    let data = app_data(&app)?;
    let Some(cancel) = translate::start_download(&tr, &leg) else {
        return Err(format!("já baixando {leg}"));
    };
    let handle = app.clone();
    let leg2 = leg.clone();
    std::thread::spawn(move || {
        let tr = handle.state::<Translator>();
        let emit = handle.clone();
        let leg_evt = leg2.clone();
        let res = translate::download_leg(&data, &leg2, &cancel, move |received, total| {
            let _ = emit.emit(
                "download-progress",
                DownloadProgress { leg: leg_evt.clone(), received, total },
            );
        });
        translate::finish_download(&tr, &leg2);
        let _ = handle.emit(
            "download-done",
            DownloadDone {
                leg: leg2.clone(),
                ok: res.is_ok(),
                error: res.err(),
            },
        );
    });
    Ok(())
}

#[tauri::command(async)]
fn cancel_download(tr: State<'_, Translator>, leg: String) {
    translate::cancel_download(&tr, &leg);
}

#[tauri::command(async)]
fn remove_model(app: AppHandle, tr: State<'_, Translator>, leg: String) -> Result<(), String> {
    translate::remove_leg(&app_data(&app)?, &tr, &leg)
}

// --- tradução ---

/// Traduz um texto inteiro (multi-linha) numa direção. Preserva quebras de linha;
/// linhas sem letra (números, "[1]") passam intactas. Se um modelo necessário não
/// estiver instalado, devolve erro pra UI mandar o usuário à tela de modelos.
#[tauri::command(async)]
fn translate_text(
    app: AppHandle,
    tr: State<'_, Translator>,
    direction: String,
    text: String,
) -> Result<String, String> {
    let data = app_data(&app)?;
    for leg in translate::legs(&direction).ok_or("direção inválida")? {
        if !translate::leg_installed(&data, leg) {
            return Err(format!("MODEL_MISSING:{leg}"));
        }
    }
    translate::translate(&data, &tr, &direction, &text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // single-instance: "abrir com" num .txt encaminha o caminho pra janela viva.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(file) = argv.iter().skip(1).find(|a| Path::new(a).is_file()) {
                let _ = app.emit("open-file", file.clone());
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Db::default())
        .manage(Translator::default())
        .setup(|app| {
            let db = app.state::<Db>().inner();
            if let Err(e) = history::open(app.handle(), db) {
                eprintln!("[localtranslate] falha ao abrir o histórico: {e}");
            }

            // Timer de descarregamento: modelos parados há >5min saem da RAM (o
            // app fica leve entre traduções). Barato — só compara instantes.
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(60));
                handle.state::<Translator>().evict_idle();
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_startup_file,
            read_text_file,
            write_text_file,
            models_status,
            download_model,
            cancel_download,
            remove_model,
            translate_text,
            history::history_add,
            history::history_list,
            history::history_delete,
            history::history_clear,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
