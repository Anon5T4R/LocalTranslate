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

/// Nome do evento que avisa a janela principal que o atalho do boot não pegou.
pub const SHORTCUT_FAILED_EVENT: &str = "quick-shortcut-failed";

/// O que o boot faz com o resultado do registro.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BootOutcome {
    /// Nada a dizer (registrou, ou o usuário não pediu atalho nenhum).
    Silent,
    /// Avisar a janela principal, com a combinação que o usuário escolheu.
    Warn(String),
}

/// Decisão do boot, separada da execução.
///
/// O caminho que interessa (o sistema RECUSAR a combinação) depende de outro
/// app estar segurando a tecla — não dá pra montar isso num teste. Separar a
/// DECISÃO da EXECUÇÃO é o que torna a regra exercitável de verdade, em vez de
/// o teste virar uma cópia da lógica. (Lição do LocalFiles 0.5.1.)
///
/// A regra tem uma sutileza que não é óbvia: com o atalho DESLIGADO (ou vazio)
/// não existe aviso, mesmo se o `unregister_all` reclamar. Quem desligou o
/// recurso de propósito não pode receber "seu atalho não funcionou" no boot —
/// seria avisar sobre algo que ninguém pediu.
pub fn boot_outcome(cfg: &QuickConfig, result: &Result<(), String>) -> BootOutcome {
    let accel = cfg.shortcut.trim();
    if !cfg.enabled || accel.is_empty() {
        return BootOutcome::Silent;
    }
    match result {
        Ok(()) => BootOutcome::Silent,
        Err(_) => BootOutcome::Warn(accel.to_string()),
    }
}

/// Registra o atalho no boot e, se falhar, **conta pra UI**.
///
/// Portado do `quake.rs` do LocalTerminal 0.5.0. Até a v0.4.0 isto aqui era só
/// um `eprintln!`: o usuário apertava a tecla, não acontecia nada, e só
/// descobria o conflito se abrisse as Configurações e salvasse de novo — o
/// erro só aparecia no caminho de SALVAR, nunca no de abrir. Falhar calado é
/// entregar recurso morto.
///
/// Falha aqui é COMUM (outro app já tem a combinação) e não pode derrubar o
/// boot: por isso o resultado vira aviso, não `Err` propagado.
pub fn apply_at_boot(app: &AppHandle, cfg: &QuickConfig) {
    let result = apply_shortcut(app, cfg);
    if let Err(e) = &result {
        eprintln!("[localtranslate] atalho global não registrado: {e}");
    }
    if let BootOutcome::Warn(accel) = boot_outcome(cfg, &result) {
        let _ = app.emit_to("main", SHORTCUT_FAILED_EVENT, accel);
    }
}

/// Chamado no `RunEvent::Exit`. Atalho global é recurso do SISTEMA: sair sem
/// devolver deixaria a combinação presa até o próximo logon. (Também portado
/// do LocalTerminal 0.5.0 — o LocalTranslate não fazia.)
pub fn release_on_exit(app: &AppHandle) {
    let _ = app.global_shortcut().unregister_all();
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

    fn cfg_com(shortcut: &str, enabled: bool) -> QuickConfig {
        QuickConfig { shortcut: shortcut.into(), enabled, ..QuickConfig::default() }
    }

    /// O caso que estava CALADO até a v0.4.0: o sistema recusa a combinação no
    /// boot e nada na tela diz por quê.
    #[test]
    fn atalho_recusado_no_boot_vira_aviso_com_a_combinacao() {
        let cfg = cfg_com("ctrl+shift+t", true);
        // Erro no formato REAL que o `apply_shortcut` produz.
        let erro = Err("SHORTCUT_BUSY:ctrl+shift+t:HotKey already registered".to_string());
        assert_eq!(boot_outcome(&cfg, &erro), BootOutcome::Warn("ctrl+shift+t".into()));
    }

    #[test]
    fn registro_bem_sucedido_nao_avisa_nada() {
        assert_eq!(boot_outcome(&cfg_com("ctrl+shift+t", true), &Ok(())), BootOutcome::Silent);
    }

    /// Quem DESLIGOU o atalho de propósito não pode receber "seu atalho não
    /// funcionou" no boot — seria avisar sobre algo que ninguém pediu. Vale
    /// também pro atalho vazio, que é como a UI representa "sem atalho".
    #[test]
    fn atalho_desligado_ou_vazio_nunca_avisa() {
        let erro = Err("qualquer coisa".to_string());
        assert_eq!(boot_outcome(&cfg_com("ctrl+shift+t", false), &erro), BootOutcome::Silent);
        assert_eq!(boot_outcome(&cfg_com("", true), &erro), BootOutcome::Silent);
        assert_eq!(boot_outcome(&cfg_com("   ", true), &erro), BootOutcome::Silent);
    }

    /// O aviso leva a combinação APARADA — é ela que aparece no banner, e um
    /// espaço sobrando viraria `"ctrl+alt+j "` entre aspas na cara do usuário.
    #[test]
    fn a_combinacao_do_aviso_vai_aparada() {
        let erro = Err("busy".to_string());
        assert_eq!(
            boot_outcome(&cfg_com("  ctrl+alt+j  ", true), &erro),
            BootOutcome::Warn("ctrl+alt+j".into())
        );
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
