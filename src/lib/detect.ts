// Detecção de idioma por heurística (pt · en · es) — sem modelo, roda no front.
// Não precisa ser perfeita: serve pra pré-selecionar a direção; o usuário troca
// num clique. Combina palavras-função distintivas com pistas de acentuação.

import type { Lang } from "./langs";

// Palavras-função características de cada idioma. Evitamos as que pt e es
// compartilham (de, que, con/com…) e priorizamos marcadores distintivos.
const STOP: Record<Lang, string[]> = {
  pt: [
    "não", "você", "está", "são", "também", "porque", "então", "isso", "muito",
    "mas", "ele", "ela", "nós", "uma", "com", "para", "pelo", "sua", "seu",
    "aqui", "fazer", "coisa", "tudo", "já", "até", "às", "nós",
  ],
  en: [
    "the", "and", "you", "that", "this", "with", "for", "are", "was", "have",
    "not", "but", "they", "from", "what", "which", "there", "would", "about",
    "your", "will", "can", "just", "how", "when",
  ],
  es: [
    "no", "una", "usted", "también", "porque", "entonces", "esto", "muy",
    "pero", "él", "ella", "nosotros", "con", "para", "por", "su", "aquí",
    "hacer", "cosa", "todo", "ya", "hasta", "está", "más", "cómo",
  ],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFC")
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

/**
 * Adivinha o idioma de um texto (pt/en/es), ou null se não houver sinal.
 * Retorna a língua com maior pontuação (palavras-função + pistas de acento).
 */
export function detectLang(text: string): Lang | null {
  const words = tokenize(text);
  if (words.length === 0) return null;

  const score: Record<Lang, number> = { pt: 0, en: 0, es: 0 };
  const sets: Record<Lang, Set<string>> = {
    pt: new Set(STOP.pt),
    en: new Set(STOP.en),
    es: new Set(STOP.es),
  };
  for (const w of words) {
    if (sets.pt.has(w)) score.pt += 1;
    if (sets.en.has(w)) score.en += 1;
    if (sets.es.has(w)) score.es += 1;
  }

  // Pistas de acentuação: ã/õ/ç ⇒ português; ñ/¿/¡ ⇒ espanhol.
  const lower = text.toLowerCase();
  const ptMarks = (lower.match(/[ãõç]/g) ?? []).length;
  const esMarks = (lower.match(/[ñ¿¡]/g) ?? []).length;
  score.pt += ptMarks * 2;
  score.es += esMarks * 2;
  // Qualquer acento agudo/grave/til reduz a chance de inglês.
  const anyAccent = /[áàâãéêíóôõúüñç]/i.test(text);
  if (anyAccent) score.en -= 1;

  const ranked = (Object.keys(score) as Lang[]).sort((a, b) => score[b] - score[a]);
  const best = ranked[0];
  if (score[best] <= 0) return null;
  // Empate exato entre os dois primeiros ⇒ sem confiança.
  if (score[best] === score[ranked[1]]) return null;
  return best;
}
