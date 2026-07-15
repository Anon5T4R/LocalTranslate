import { describe, expect, it } from "vitest";
import { allDirections, dirId, dirLabel, langInfo } from "../langs";

describe("langs", () => {
  it("gera as 6 direções (from ≠ to)", () => {
    const dirs = allDirections();
    expect(dirs).toHaveLength(6);
    expect(dirs.every((d) => d.from !== d.to)).toBe(true);
    const ids = dirs.map((d) => d.id).sort();
    expect(ids).toEqual(
      ["en-es", "en-pt", "es-en", "es-pt", "pt-en", "pt-es"].sort(),
    );
  });

  it("dirId concatena com hífen", () => {
    expect(dirId("pt", "en")).toBe("pt-en");
  });

  it("dirLabel é legível", () => {
    expect(dirLabel("pt-en")).toBe("Português → English");
    expect(dirLabel("es-pt")).toBe("Español → Português");
  });

  it("langInfo cai no primeiro idioma pra código inválido", () => {
    // @ts-expect-error teste de robustez com código fora do tipo
    expect(langInfo("xx").code).toBe("pt");
  });
});
