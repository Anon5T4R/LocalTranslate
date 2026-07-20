//! Janela rápida: um atalho global do sistema abre uma janelinha já com o
//! conteúdo da área de transferência, traduz, e some.
//!
//! Padrão reusado do LocalClip (bandeja + `tauri-plugin-global-shortcut` +
//! `single-instance`), com duas diferenças:
//!
//! - **Janela própria** (`quick`, `quick.html`) em vez de mostrar/esconder a
//!   principal. A principal do LocalTranslate é um app inteiro (histórico,
//!   modelos, configurações); reaproveitá-la como popup daria uma janela de
//!   1100×740 na cara de quem só queria ver o que uma frase quer dizer.
//! - **Atalho configurável**, registrado em tempo de execução (padrão do
//!   LocalImage) — `ctrl+shift+t` é palpite, não lei, e colide com "reabrir aba"
//!   de navegador em algumas máquinas.
//!
//! O atalho é registrado no boot a partir de `quick.json` em `app_data`. Registro
//! é *sonda que mente por omissão*: `register()` devolve `Err` quando a combinação
//! já é de outro app, e esse erro tem que chegar na UI — senão o usuário aperta
//! a tecla, nada acontece, e o app parece quebrado.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct QuickConfig {
    /// Combinação no formato do plugin ("ctrl+shift+t"). Vazio = desligado.
    pub shortcut: String,
    pub enabled: bool,
    /// Direção usada pela janelinha (ela não tem tela de configuração).
    pub direction: String,
    /// Fechar a janelinha ao perder o foco (clique fora).
    pub hide_on_blur: bool,
    /// Fechar a janela principal manda o app pra bandeja em vez de sair.
    /// Padrão `false`: fechar fecha, que é o que a janela promete. Quem quer o
    /// atalho global valendo o dia inteiro liga isto de propósito.
    pub keep_in_tray: bool,
}

impl Default for QuickConfig {
    fn default() -> Self {
        Self {
            shortcut: "ctrl+shift+t".into(),
            enabled: true,
            direction: "en-pt".into(),
            hide_on_blur: true,
            keep_in_tray: false,
        }
    }
}

fn config_path(app_data: &Path) -> PathBuf {
    app_data.join("quick.json")
}

pub fn load(app_data: &Path) -> QuickConfig {
    std::fs::read_to_string(config_path(app_data))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(app_data: &Path, cfg: &QuickConfig) -> Result<(), String> {
    std::fs::create_dir_all(app_data).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(config_path(app_data), json).map_err(|e| e.to_string())
}

/// (Re)registra o atalho. Erro do sistema (combinação já tomada) sobe pra UI.
pub fn apply_shortcut(app: &AppHandle, cfg: &QuickConfig) -> Result<(), String> {
    let gs = app.global_shortcut();
    // Solta tudo antes: o atalho antigo continuaria valendo, e o usuário teria
    // dois atalhos abrindo a mesma janela sem saber por quê.
    gs.unregister_all().map_err(|e| e.to_string())?;
    if !cfg.enabled || cfg.shortcut.trim().is_empty() {
        return Ok(());
    }
    gs.register(cfg.shortcut.trim())
        .map_err(|e| format!("SHORTCUT_BUSY:{}:{}", cfg.shortcut.trim(), e))
}

/// Mostra a janelinha com o texto que estiver na área de transferência.
pub fn open_quick(app: &AppHandle) {
    let clip = app.clipboard().read_text().unwrap_or_default();
    let Some(w) = app.get_webview_window("quick") else {
        return;
    };
    let _ = w.center();
    let _ = w.show();
    let _ = w.set_focus();
    // O webview interno precisa do foco à parte quando a janela nasce com
    // `focus: false` — sem isso o textarea não recebe tecla (achado do Record).
    let inner: &tauri::Webview<_> = w.as_ref();
    let _ = inner.set_focus();
    let _ = app.emit_to("quick", "quick-open", clip);
}

// ---------- comandos ----------

#[tauri::command(async)]
pub fn quick_config(app: AppHandle) -> Result<QuickConfig, String> {
    Ok(load(&crate::app_data(&app)?))
}

#[tauri::command(async)]
pub fn quick_config_set(app: AppHandle, cfg: QuickConfig) -> Result<(), String> {
    save(&crate::app_data(&app)?, &cfg)?;
    apply_shortcut(&app, &cfg)
}

#[tauri::command(async)]
pub fn quick_hide(app: AppHandle) {
    if let Some(w) = app.get_webview_window("quick") {
        let _ = w.hide();
    }
}

#[tauri::command(async)]
pub fn clipboard_read(app: AppHandle) -> Result<String, String> {
    app.clipboard().read_text().map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn clipboard_write(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_ausente_cai_no_padrao_e_ida_e_volta_preserva() {
        let dir = std::env::temp_dir().join(format!("lt-quick-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let d = load(&dir);
        assert_eq!(d.shortcut, "ctrl+shift+t");
        assert!(d.enabled && d.hide_on_blur);

        let cfg = QuickConfig {
            shortcut: "alt+space".into(),
            enabled: false,
            direction: "pt-en".into(),
            hide_on_blur: false,
            keep_in_tray: true,
        };
        save(&dir, &cfg).unwrap();
        let back = load(&dir);
        assert_eq!(back.shortcut, "alt+space");
        assert!(!back.enabled && !back.hide_on_blur && back.keep_in_tray);
        assert_eq!(back.direction, "pt-en");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Config antiga (sem a chave nova) não pode apagar o app: `default` no
    /// serde faz o campo faltando nascer com o padrão em vez de erro.
    #[test]
    fn json_parcial_completa_com_o_padrao() {
        let c: QuickConfig = serde_json::from_str(r#"{"shortcut":"ctrl+alt+j"}"#).unwrap();
        assert_eq!(c.shortcut, "ctrl+alt+j");
        assert!(c.enabled);
        assert!(!c.keep_in_tray);
        assert_eq!(c.direction, "en-pt");
    }
}
