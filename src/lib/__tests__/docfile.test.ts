import { describe, expect, it } from "vitest";
import { isMd, suggestOut } from "../docfile";

describe("isMd", () => {
  it("reconhece as extensões de markdown, em qualquer caixa", () => {
    expect(isMd("C:\\docs\\notas.md")).toBe(true);
    expect(isMd("/home/x/LEIAME.MD")).toBe(true);
    expect(isMd("a.markdown")).toBe(true);
    expect(isMd("a.mdown")).toBe(true);
  });

  it("não confunde texto puro com markdown", () => {
    expect(isMd("notas.txt")).toBe(false);
    expect(isMd("sem-extensao")).toBe(false);
    // "md" no meio do nome não é extensão
    expect(isMd("mdados.txt")).toBe(false);
  });
});

describe("suggestOut", () => {
  it("mete o idioma antes da extensão", () => {
    expect(suggestOut("C:\\docs\\notas.md", "pt")).toBe("C:\\docs\\notas.pt.md");
    expect(suggestOut("/home/x/readme.txt", "es")).toBe("/home/x/readme.es.txt");
  });

  it("sem extensão, só acrescenta", () => {
    expect(suggestOut("/home/x/LEIAME", "en")).toBe("/home/x/LEIAME.en");
  });

  it("ponto na PASTA não vira extensão do arquivo", () => {
    expect(suggestOut("C:\\meu.projeto\\notas", "pt")).toBe("C:\\meu.projeto\\notas.pt");
  });

  it("nunca devolve o caminho de entrada (sobrescrever seria perda calada)", () => {
    for (const p of ["a.md", "/x/y.txt", "z", "C:\\a.b\\c"]) {
      expect(suggestOut(p, "pt")).not.toBe(p);
    }
  });
});
