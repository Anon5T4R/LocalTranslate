import { describe, expect, it } from "vitest";
import { detectLang } from "../detect";

describe("detectLang", () => {
  it("reconhece português", () => {
    expect(detectLang("Você não está aqui, mas também não faz sentido.")).toBe("pt");
  });

  it("reconhece inglês", () => {
    expect(detectLang("The quick brown fox and the lazy dog are here.")).toBe("en");
  });

  it("reconhece espanhol", () => {
    expect(detectLang("¿Dónde está el niño? También quiero una manzana.")).toBe("es");
  });

  it("usa a cedilha/til pra desempatar pt", () => {
    expect(detectLang("Informação e coração.")).toBe("pt");
  });

  it("usa o ñ pra espanhol", () => {
    expect(detectLang("El señor mañana.")).toBe("es");
  });

  it("texto vazio ou só símbolos ⇒ null", () => {
    expect(detectLang("")).toBeNull();
    expect(detectLang("123 [4] — 5.6")).toBeNull();
  });
});
