import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getLocale, setLocale, t, type Locale } from "../i18n";

const LOCALES: Locale[] = ["pt", "en", "es"];

describe("aviso de atalho global recusado no boot", () => {
  let antes: Locale;
  beforeEach(() => {
    antes = getLocale();
  });
  afterEach(() => {
    setLocale(antes);
  });

  /**
   * O `Record<MessageKey, string>` faz o `tsc` recusar chave FALTANDO, mas ele
   * não vê dentro do texto: uma tradução que esquecesse o `{accel}` compilaria
   * e entregaria um banner dizendo "o atalho global não foi registrado" sem
   * dizer QUAL — justo o dado que o usuário precisa pra ir trocar.
   */
  it("interpola a combinação nos 3 idiomas", () => {
    for (const loc of LOCALES) {
      setLocale(loc);
      const msg = t("settings.bootBusy", { accel: "ctrl+shift+t" });
      expect(msg, loc).toContain("ctrl+shift+t");
      expect(msg, loc).not.toContain("{accel}");
    }
  });

  it("os rótulos dos botões existem e são distintos nos 3 idiomas", () => {
    for (const loc of LOCALES) {
      setLocale(loc);
      const fix = t("settings.bootBusyFix");
      const dismiss = t("settings.bootBusyDismiss");
      // `t()` devolve a própria chave quando ela não existe no dicionário —
      // então comparar com a chave é o que separa "traduzido" de "vazou".
      expect(fix, loc).not.toBe("settings.bootBusyFix");
      expect(dismiss, loc).not.toBe("settings.bootBusyDismiss");
      expect(fix, loc).not.toBe(dismiss);
    }
  });

  /**
   * O aviso do BOOT e o do SALVAR são mensagens diferentes de propósito: no
   * boot o usuário não fez nada e precisa saber que o recurso está morto; ao
   * salvar ele acabou de escolher a combinação e já sabe o contexto.
   */
  it("não é a mesma mensagem do erro ao salvar", () => {
    for (const loc of LOCALES) {
      setLocale(loc);
      expect(t("settings.bootBusy", { accel: "x" }), loc).not.toBe(
        t("settings.quickBusy", { accel: "x" }),
      );
    }
  });
});
