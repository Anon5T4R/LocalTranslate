mod history;
mod md;
mod quick;
mod translate;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

use history::Db;
use translate::{DirectionStatus, Translator};

/// Pasta de dados do app (onde ficam os modelos e o histórico).
pub(crate) fn app_data(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

/// Traz a janela principal de volta (bandeja, 2º launch).
fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
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

// --- tradução de documento (.txt / .md) ---

/// Cancelamento da tradução de documento em andamento (uma por vez).
#[derive(Default)]
struct DocJob(std::sync::Mutex<Option<Arc<AtomicBool>>>);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DocProgress {
    done: usize,
    total: usize,
}

/// Quantos trechos vão ao modelo por lote. Lotes pequenos = progresso mais
/// vivo e cancelamento mais rápido; o modelo já está na RAM, então o custo de
/// dividir é zero (o `engine_for` acha o motor no cache).
const DOC_BATCH: usize = 8;

/// Traduz um documento inteiro preservando a estrutura (ver `md.rs`).
///
/// Roda em `async` (thread pool do Tauri), então a janela **não trava** —
/// o progresso chega pelo evento `doc-progress` e dá pra cancelar.
#[tauri::command(async)]
fn translate_document(
    app: AppHandle,
    tr: State<'_, Translator>,
    job: State<'_, DocJob>,
    direction: String,
    text: String,
    markdown: bool,
) -> Result<String, String> {
    let data = app_data(&app)?;
    for leg in translate::legs(&direction).ok_or("direção inválida")? {
        if !translate::leg_installed(&data, leg) {
            return Err(format!("MODEL_MISSING:{leg}"));
        }
    }

    let total = md::prose_count(&text, markdown);
    let flag = Arc::new(AtomicBool::new(false));
    *job.0.lock().unwrap() = Some(flag.clone());
    let _ = app.emit("doc-progress", DocProgress { done: 0, total });

    let mut done = 0usize;
    let mut last = Instant::now();
    let res = md::translate_doc(&text, markdown, |batch| {
        let mut out = Vec::with_capacity(batch.len());
        for group in batch.chunks(DOC_BATCH) {
            if flag.load(Ordering::Relaxed) {
                return Err("cancelado".into());
            }
            out.extend(translate::translate_texts(
                &data,
                &tr,
                &direction,
                group.to_vec(),
            )?);
            done += group.len();
            if last.elapsed() >= Duration::from_millis(250) {
                last = Instant::now();
                let _ = app.emit(
                    "doc-progress",
                    DocProgress { done: done.min(total), total },
                );
            }
        }
        Ok(out)
    });

    *job.0.lock().unwrap() = None;
    let _ = app.emit("doc-progress", DocProgress { done: total, total });
    res
}

#[tauri::command(async)]
fn cancel_document(job: State<'_, DocJob>) {
    if let Some(f) = job.0.lock().unwrap().as_ref() {
        f.store(true, Ordering::Relaxed);
    }
}

/// Quantos trechos o documento tem (estimativa de trabalho antes de começar).
#[tauri::command(async)]
fn document_units(text: String, markdown: bool) -> usize {
    md::prose_count(&text, markdown)
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
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            // Sem atalhos fixos: quem manda é o `quick.json`, aplicado no setup.
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    // Sem o filtro de Pressed o handler dispara 2x por toque
                    // (press + release) e a janela abriria e fecharia sozinha.
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        quick::open_quick(app);
                    }
                })
                .build(),
        )
        .manage(Db::default())
        .manage(Translator::default())
        .manage(DocJob::default())
        .setup(|app| {
            let db = app.state::<Db>().inner();
            if let Err(e) = history::open(app.handle(), db) {
                eprintln!("[localtranslate] falha ao abrir o histórico: {e}");
            }

            // Bandeja: o atalho global só serve se o app continuar vivo depois
            // que o usuário fecha a janela.
            let abrir = MenuItem::with_id(app, "abrir", "Abrir LocalTranslate", true, None::<&str>)?;
            let rapida = MenuItem::with_id(app, "rapida", "Tradução rápida", true, None::<&str>)?;
            let sair = MenuItem::with_id(app, "sair", "Sair", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&abrir, &rapida, &sair])?;
            let _tray = TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("LocalTranslate")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, ev| match ev.id.as_ref() {
                    "abrir" => show_main(app),
                    "rapida" => quick::open_quick(app),
                    "sair" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, ev| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = ev
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            // Atalho global a partir do que estiver salvo. Falha aqui é comum
            // (combinação já tomada por outro app) e NÃO pode derrubar o boot —
            // vira aviso e a UI de configurações mostra o erro ao tentar de novo.
            if let Ok(data) = app_data(app.handle()) {
                let cfg = quick::load(&data);
                if let Err(e) = quick::apply_shortcut(app.handle(), &cfg) {
                    eprintln!("[localtranslate] atalho global não registrado: {e}");
                }
            }

            // Fechar a principal só manda pra bandeja se o usuário pediu — a
            // janela `quick` fica viva (escondida) e sozinha ela impediria o
            // app de sair, deixando um processo invisível rodando.
            if let Some(main) = app.get_webview_window("main") {
                let h = app.handle().clone();
                main.clone().on_window_event(move |ev| {
                    if let WindowEvent::CloseRequested { api, .. } = ev {
                        let tray = app_data(&h).map(|d| quick::load(&d).keep_in_tray).unwrap_or(false);
                        if tray {
                            api.prevent_close();
                            let _ = main.hide();
                        } else {
                            h.exit(0);
                        }
                    }
                });
            }

            // A janelinha some ao perder o foco (clique fora), como todo popup de
            // sistema. Mas `Focused(false)` chega também no instante seguinte ao
            // `show()` em algumas máquinas — se o Rust escondesse direto, a janela
            // abriria e sumiria no mesmo piscar. Por isso quem decide é o front,
            // que sabe há quanto tempo abriu.
            if let Some(q) = app.get_webview_window("quick") {
                let h = app.handle().clone();
                q.on_window_event(move |ev| {
                    if let WindowEvent::Focused(false) = ev {
                        let _ = h.emit_to("quick", "quick-blur", ());
                    }
                });
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
            translate_document,
            cancel_document,
            document_units,
            quick::quick_config,
            quick::quick_config_set,
            quick::quick_hide,
            quick::clipboard_read,
            quick::clipboard_write,
            history::history_add,
            history::history_list,
            history::history_delete,
            history::history_clear,
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
