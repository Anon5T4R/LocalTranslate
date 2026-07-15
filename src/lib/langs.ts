// Idiomas e direções da suíte (3 idiomas → 6 combinações). pt↔es pivota pelo
// inglês no back; a UI só conhece a direção "from-to".

export type Lang = "pt" | "en" | "es";

export interface LangInfo {
  code: Lang;
  name: string;
  flag: string;
}

export const LANGS: LangInfo[] = [
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
];

export function langInfo(code: Lang): LangInfo {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}

/** Id da direção usado no back ("pt-en"). */
export function dirId(from: Lang, to: Lang): string {
  return `${from}-${to}`;
}

/** As 6 direções válidas (from ≠ to). */
export function allDirections(): { from: Lang; to: Lang; id: string }[] {
  const out: { from: Lang; to: Lang; id: string }[] = [];
  for (const from of LANGS) {
    for (const to of LANGS) {
      if (from.code !== to.code) {
        out.push({ from: from.code, to: to.code, id: dirId(from.code, to.code) });
      }
    }
  }
  return out;
}

/** Rótulo legível de uma direção ("Português → English"). */
export function dirLabel(id: string): string {
  const [from, to] = id.split("-") as [Lang, Lang];
  return `${langInfo(from).name} → ${langInfo(to).name}`;
}
