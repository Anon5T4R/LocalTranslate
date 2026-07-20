// Regras de nome/formato do arquivo traduzido. Fora do componente pra poder
// ser testado — o `.md` é o que liga o modo que preserva a estrutura, então
// errar a detecção aqui estraga o documento inteiro.

const MD_EXTS = [".md", ".markdown", ".mdown"];

/** Markdown liga o modo estrutural; qualquer outra coisa é texto puro. */
export function isMd(path: string): boolean {
  const l = path.toLowerCase();
  return MD_EXTS.some((e) => l.endsWith(e));
}

/**
 * Sugere o nome da saída: `notas.md` + `pt` → `notas.pt.md`.
 * NUNCA devolve o próprio caminho de entrada — sobrescrever o original seria
 * perder o texto de origem sem aviso.
 */
export function suggestOut(path: string, to: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const dot = path.lastIndexOf(".");
  return dot > slash + 1
    ? `${path.slice(0, dot)}.${to}${path.slice(dot)}`
    : `${path}.${to}`;
}
