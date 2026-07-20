//! Segmentação de documentos (`.txt` e `.md`) para tradução **preservando a
//! estrutura**.
//!
//! O problema: um tradutor neural recebe texto e devolve texto. Se você jogar um
//! Markdown inteiro nele, o modelo traduz o `#` do cabeçalho, inventa acento na
//! URL do link, "traduz" o conteúdo do bloco de código e some com os `` ` ``.
//! A estrutura não sobrevive — e num arquivo de documentação isso é perda de
//! dado, não erro cosmético.
//!
//! A solução aqui é **nunca deixar o modelo ver o que não pode mudar**. O
//! documento vira uma lista de [`Piece`]:
//!
//! - [`Piece::Verbatim`] — sai byte a byte igual ao que entrou (fence de código,
//!   marcador de lista, URL, `---` de front matter, linha em branco…).
//! - [`Piece::Prose`] — vai pro modelo.
//!
//! Dentro de uma linha de prosa ainda sobram trechos intocáveis (`inline`,
//! `**`, `](url)`). Dois mecanismos cuidam disso, nesta ordem:
//!
//! 1. **Içamento** — trecho protegido no *começo* ou no *fim* da linha vira
//!    `Verbatim` próprio, sem passar pelo modelo. Cobre o caso comum
//!    (`- **Item:** texto`, `[link](url)` sozinho) sem custo nenhum.
//! 2. **Marcador** — o que sobra no *meio* vira `#0#`, `#1#`… no texto mandado
//!    ao modelo, e volta ao lugar depois. Marcador é aposta: o modelo pode
//!    comê-lo. Por isso a restauração é **verificada**, e quando falha o trecho
//!    é retraduzido **em pedaços** (cada pedaço de prosa separado, os protegidos
//!    intactos). O caminho de pedaços é mais burro, mas é o que garante que a
//!    estrutura sempre volta — o marcador é só a otimização de qualidade.
//!
//! Tudo aqui é função pura: [`translate_doc`] recebe a função de tradução como
//! argumento, então os testes exercitam o caminho inteiro sem carregar modelo.

/// Marcador de trecho protegido dentro de uma linha de prosa.
fn ph(i: usize) -> String {
    format!("#{i}#")
}

/// Pedaço de documento pronto pra montagem final.
#[derive(Debug, Clone, PartialEq)]
pub enum Piece {
    /// Reproduzido tal e qual.
    Verbatim(String),
    /// Traduzido. `masked` tem `#i#` no lugar de cada trecho de `subs`.
    Prose { masked: String, subs: Vec<String> },
}

/// Fragmento de uma linha durante a análise inline.
#[derive(Debug, Clone, PartialEq)]
enum Frag {
    Keep(String),
    Text(String),
}

fn has_alpha(s: &str) -> bool {
    s.chars().any(|c| c.is_alphabetic())
}

// ---------- análise inline ----------

/// Quebra uma linha de prosa em fragmentos, separando o que o modelo pode ver
/// do que tem que sair intacto.
fn frags(line: &str) -> Vec<Frag> {
    let b: Vec<char> = line.chars().collect();
    let mut out: Vec<Frag> = Vec::new();
    let mut text = String::new();
    let mut i = 0usize;

    macro_rules! flush {
        () => {
            if !text.is_empty() {
                out.push(Frag::Text(std::mem::take(&mut text)));
            }
        };
    }
    macro_rules! keep {
        ($s:expr) => {{
            flush!();
            out.push(Frag::Keep($s));
        }};
    }

    while i < b.len() {
        let c = b[i];
        match c {
            // Escape do Markdown: "\*" não é ênfase, é asterisco literal.
            '\\' if i + 1 < b.len() && b[i + 1].is_ascii_punctuation() => {
                keep!(format!("{}{}", b[i], b[i + 1]));
                i += 2;
            }
            // Código inline: run de N crases fecha com run de N crases.
            '`' => {
                let n = b[i..].iter().take_while(|&&x| x == '`').count();
                let close = find_backtick_run(&b, i + n, n);
                match close {
                    Some(j) => {
                        keep!(b[i..j + n].iter().collect());
                        i = j + n;
                    }
                    None => {
                        keep!(b[i..i + n].iter().collect());
                        i += n;
                    }
                }
            }
            // Tag HTML ou autolink <https://…>: some inteiro.
            '<' => match find_char(&b, i + 1, '>') {
                Some(j) if j > i + 1 && !b[i + 1].is_whitespace() => {
                    keep!(b[i..=j].iter().collect());
                    i = j + 1;
                }
                _ => {
                    text.push(c);
                    i += 1;
                }
            },
            // Abertura de imagem/link: o ALT/TEXTO fica traduzível, os colchetes não.
            '!' if i + 1 < b.len() && b[i + 1] == '[' => {
                keep!("![".into());
                i += 2;
            }
            '[' => {
                keep!("[".into());
                i += 1;
            }
            // Fechamento: "](url)" e "][ref]" saem inteiros; "]" solto também.
            ']' => {
                let next = b.get(i + 1).copied();
                let end = match next {
                    Some('(') => find_char(&b, i + 2, ')'),
                    Some('[') => find_char(&b, i + 2, ']'),
                    _ => None,
                };
                match end {
                    Some(j) => {
                        keep!(b[i..=j].iter().collect());
                        i = j + 1;
                    }
                    None => {
                        keep!("]".into());
                        i += 1;
                    }
                }
            }
            // Marcadores de ênfase/riscado: o run inteiro é preservado.
            '*' | '_' | '~' => {
                let n = b[i..].iter().take_while(|&&x| x == c).count();
                keep!(b[i..i + n].iter().collect());
                i += n;
            }
            _ => {
                text.push(c);
                i += 1;
            }
        }
    }
    if !text.is_empty() {
        out.push(Frag::Text(text));
    }
    out
}

fn find_char(b: &[char], from: usize, target: char) -> Option<usize> {
    (from..b.len()).find(|&j| b[j] == target)
}

/// Primeiro run de exatamente `n` crases a partir de `from`.
fn find_backtick_run(b: &[char], from: usize, n: usize) -> Option<usize> {
    let mut j = from;
    while j < b.len() {
        if b[j] == '`' {
            let run = b[j..].iter().take_while(|&&x| x == '`').count();
            if run == n {
                return Some(j);
            }
            j += run;
        } else {
            j += 1;
        }
    }
    None
}

/// Converte fragmentos em peças, içando os protegidos das pontas.
fn pieces_from_frags(fr: Vec<Frag>) -> Vec<Piece> {
    // Sem nenhum texto com letra, a linha inteira é literal.
    if !fr.iter().any(|f| matches!(f, Frag::Text(t) if has_alpha(t))) {
        let joined: String = fr
            .into_iter()
            .map(|f| match f {
                Frag::Keep(s) | Frag::Text(s) => s,
            })
            .collect();
        return vec![Piece::Verbatim(joined)];
    }

    let first_text = fr.iter().position(|f| matches!(f, Frag::Text(_))).unwrap();
    let last_text = fr.iter().rposition(|f| matches!(f, Frag::Text(_))).unwrap();

    let mut out = Vec::new();
    let head: String = fr[..first_text]
        .iter()
        .map(|f| match f {
            Frag::Keep(s) | Frag::Text(s) => s.as_str(),
        })
        .collect();
    if !head.is_empty() {
        out.push(Piece::Verbatim(head));
    }

    let mut masked = String::new();
    let mut subs: Vec<String> = Vec::new();
    for f in &fr[first_text..=last_text] {
        match f {
            Frag::Text(s) => masked.push_str(s),
            Frag::Keep(s) => {
                masked.push_str(&ph(subs.len()));
                subs.push(s.clone());
            }
        }
    }

    // Espaço nas bordas não vai pro modelo (ele apara, e aí a célula da tabela
    // ou o item de lista encosta no delimitador).
    let lead = masked.len() - masked.trim_start().len();
    let core_end = masked.trim_end().len();
    let head2 = masked[..lead].to_string();
    let tail2 = masked[core_end..].to_string();
    let core = masked[lead..core_end].to_string();
    if !head2.is_empty() {
        match out.last_mut() {
            Some(Piece::Verbatim(v)) => v.push_str(&head2),
            _ => out.push(Piece::Verbatim(head2)),
        }
    }
    out.push(Piece::Prose { masked: core, subs });
    if !tail2.is_empty() {
        out.push(Piece::Verbatim(tail2));
    }

    let tail: String = fr[last_text + 1..]
        .iter()
        .map(|f| match f {
            Frag::Keep(s) | Frag::Text(s) => s.as_str(),
        })
        .collect();
    if !tail.is_empty() {
        match out.last_mut() {
            Some(Piece::Verbatim(v)) => v.push_str(&tail),
            _ => out.push(Piece::Verbatim(tail)),
        }
    }
    out
}

/// Prosa simples (`.txt`): nada de inline, a linha inteira vai pro modelo.
fn plain_pieces(line: &str) -> Vec<Piece> {
    if !has_alpha(line) {
        return vec![Piece::Verbatim(line.to_string())];
    }
    // Indentação de fora preservada (o modelo comeria o espaço da esquerda).
    let start = line.len() - line.trim_start().len();
    let end = line.trim_end().len();
    let mut out = Vec::new();
    if start > 0 {
        out.push(Piece::Verbatim(line[..start].to_string()));
    }
    out.push(Piece::Prose {
        masked: line[start..end].to_string(),
        subs: Vec::new(),
    });
    if end < line.len() {
        out.push(Piece::Verbatim(line[end..].to_string()));
    }
    out
}

// ---------- análise por linha ----------

fn is_hrule(t: &str) -> bool {
    let s: String = t.chars().filter(|c| !c.is_whitespace()).collect();
    s.len() >= 3
        && (s.chars().all(|c| c == '-') || s.chars().all(|c| c == '*') || s.chars().all(|c| c == '_'))
}

/// Linha separadora de tabela: `|---|:--:|`.
fn is_table_sep(t: &str) -> bool {
    t.starts_with('|')
        && t.chars().all(|c| matches!(c, '|' | '-' | ':' | ' ' | '\t'))
        && t.contains('-')
}

/// Definição de link de referência: `[ref]: https://…`.
fn is_link_def(t: &str) -> bool {
    t.starts_with('[') && t.split_once("]:").is_some()
}

/// Marcador de bloco no começo da linha (indentação + citação + lista + tarefa).
/// Devolve o tamanho em bytes do prefixo que tem que sair intacto.
fn block_prefix(line: &str) -> usize {
    let b = line.as_bytes();
    let mut i = 0usize;
    // indentação
    while i < b.len() && (b[i] == b' ' || b[i] == b'\t') {
        i += 1;
    }
    // citações aninhadas: "> > "
    loop {
        if i < b.len() && b[i] == b'>' {
            i += 1;
            while i < b.len() && b[i] == b' ' {
                i += 1;
            }
        } else {
            break;
        }
    }
    // marcador de lista: "- ", "* ", "+ ", "12. ", "3) "
    let rest = &line[i..];
    let rb = rest.as_bytes();
    if rb.len() >= 2 && matches!(rb[0], b'-' | b'*' | b'+') && (rb[1] == b' ' || rb[1] == b'\t') {
        i += 2;
        while i < b.len() && b[i] == b' ' {
            i += 1;
        }
    } else {
        let digits = rb.iter().take_while(|c| c.is_ascii_digit()).count();
        if digits > 0
            && rb.len() > digits + 1
            && matches!(rb[digits], b'.' | b')')
            && (rb[digits + 1] == b' ' || rb[digits + 1] == b'\t')
        {
            i += digits + 2;
            while i < b.len() && b[i] == b' ' {
                i += 1;
            }
        }
    }
    // caixa de tarefa: "[ ] " / "[x] "
    let rest = &line[i..];
    let rb = rest.as_bytes();
    if rb.len() >= 4 && rb[0] == b'[' && rb[2] == b']' && rb[3] == b' ' {
        i += 4;
    }
    i
}

fn heading_prefix(line: &str) -> Option<usize> {
    let hashes = line.chars().take_while(|&c| c == '#').count();
    if hashes == 0 || hashes > 6 {
        return None;
    }
    let rest = &line[hashes..];
    if !rest.starts_with(' ') && !rest.is_empty() {
        return None;
    }
    let spaces = rest.len() - rest.trim_start_matches(' ').len();
    Some(hashes + spaces)
}

/// Linha de tabela: cada célula é prosa; as barras são literais.
fn table_pieces(line: &str) -> Vec<Piece> {
    let mut out = Vec::new();
    let mut rest = line;
    while let Some(idx) = rest.find('|') {
        let (cell, after) = rest.split_at(idx);
        if !cell.is_empty() {
            out.extend(pieces_from_frags(frags(cell)));
        }
        out.push(Piece::Verbatim("|".into()));
        rest = &after[1..];
    }
    if !rest.is_empty() {
        out.extend(pieces_from_frags(frags(rest)));
    }
    out
}

/// Divide o documento em peças. `is_md = false` trata tudo como texto puro.
pub fn segment(doc: &str, is_md: bool) -> Vec<Piece> {
    let mut out: Vec<Piece> = Vec::new();
    let lines: Vec<&str> = doc.split('\n').collect();

    // Estado do varredor: fence aberto (caractere + tamanho) e front matter.
    let mut fence: Option<(char, usize)> = None;
    let mut in_front = false;
    let mut prev_blank = true;
    let mut in_indent_code = false;

    for (n, raw) in lines.iter().enumerate() {
        if n > 0 {
            out.push(Piece::Verbatim("\n".into()));
        }
        // `\r` do CRLF viaja junto com a linha e volta intacto.
        let (line, cr) = match raw.strip_suffix('\r') {
            Some(l) => (l, "\r"),
            None => (*raw, ""),
        };
        let trimmed = line.trim();

        // Macro (e não closure) de propósito: closure segurando `&mut out`
        // brigaria com o `out.extend` do caminho de prosa mais abaixo.
        macro_rules! push_verbatim {
            ($s:expr) => {
                out.push(Piece::Verbatim(format!("{}{}", $s, cr)))
            };
        }

        if !is_md {
            let mut p = plain_pieces(line);
            if !cr.is_empty() {
                p.push(Piece::Verbatim(cr.into()));
            }
            out.extend(p);
            continue;
        }

        // --- front matter YAML no topo ---
        if in_front {
            if trimmed == "---" || trimmed == "..." {
                in_front = false;
            }
            push_verbatim!(line);
            continue;
        }
        if n == 0 && trimmed == "---" {
            in_front = true;
            push_verbatim!(line);
            continue;
        }

        // --- bloco de código cercado ---
        if let Some((fc, flen)) = fence {
            let run = trimmed.chars().take_while(|&c| c == fc).count();
            if run >= flen && trimmed.chars().skip(run).all(|c| c.is_whitespace()) {
                fence = None;
            }
            push_verbatim!(line);
            prev_blank = false;
            continue;
        }
        let fc = trimmed.chars().next();
        if matches!(fc, Some('`') | Some('~')) {
            let fc = fc.unwrap();
            let run = trimmed.chars().take_while(|&c| c == fc).count();
            if run >= 3 {
                fence = Some((fc, run));
                push_verbatim!(line);
                prev_blank = false;
                continue;
            }
        }

        if trimmed.is_empty() {
            push_verbatim!(line);
            prev_blank = true;
            // Linha em branco não fecha bloco de código indentado.
            continue;
        }

        // --- bloco de código indentado (4 espaços/tab) ---
        let indented = line.starts_with("    ") || line.starts_with('\t');
        let looks_like_list = {
            let t = line.trim_start();
            block_prefix(t) > 0
        };
        if indented && !looks_like_list && (in_indent_code || prev_blank) {
            in_indent_code = true;
            push_verbatim!(line);
            prev_blank = false;
            continue;
        }
        in_indent_code = false;

        // --- linhas inteiras literais ---
        if is_hrule(trimmed)
            || is_table_sep(trimmed)
            || is_link_def(trimmed)
            || trimmed.starts_with('<')
        {
            push_verbatim!(line);
            prev_blank = false;
            continue;
        }

        prev_blank = false;

        // --- cabeçalho ATX ---
        let pre = block_prefix(line);
        let body = &line[pre..];
        let (pre, body) = match heading_prefix(body) {
            Some(h) => (pre + h, &body[h..]),
            None => (pre, body),
        };
        if pre > 0 {
            out.push(Piece::Verbatim(line[..pre].to_string()));
        }

        // --- tabela ---
        if body.trim_start().starts_with('|') {
            out.extend(table_pieces(body));
        } else {
            out.extend(pieces_from_frags(frags(body)));
        }
        if !cr.is_empty() {
            out.push(Piece::Verbatim(cr.into()));
        }
    }
    out
}

// ---------- restauração dos marcadores ----------

/// Lê `#12#` (tolerante a espaço que o modelo tenha metido: `# 12 #`).
/// Devolve `(índice, posição depois do marcador)`.
fn read_ph(b: &[char], i: usize) -> Option<(usize, usize)> {
    if b[i] != '#' {
        return None;
    }
    let mut j = i + 1;
    while j < b.len() && b[j] == ' ' {
        j += 1;
    }
    let start = j;
    while j < b.len() && b[j].is_ascii_digit() {
        j += 1;
    }
    if j == start {
        return None;
    }
    let idx: usize = b[start..j].iter().collect::<String>().parse().ok()?;
    while j < b.len() && b[j] == ' ' {
        j += 1;
    }
    if j < b.len() && b[j] == '#' {
        Some((idx, j + 1))
    } else {
        None
    }
}

/// Troca os marcadores pelos trechos originais. `None` se algum sumiu ou
/// duplicou — nesse caso quem chama cai no plano B (tradução em pedaços).
fn unmask(out: &str, subs: &[String]) -> Option<String> {
    if subs.is_empty() {
        return Some(out.to_string());
    }
    let b: Vec<char> = out.chars().collect();
    let mut seen = vec![0usize; subs.len()];
    let mut s = String::new();
    let mut i = 0;
    while i < b.len() {
        match read_ph(&b, i) {
            Some((idx, next)) if idx < subs.len() => {
                seen[idx] += 1;
                s.push_str(&subs[idx]);
                i = next;
            }
            _ => {
                s.push(b[i]);
                i += 1;
            }
        }
    }
    if seen.iter().all(|&c| c == 1) {
        Some(s)
    } else {
        None
    }
}

/// Quebra `masked` nos marcadores. Devolve os trechos de texto entre eles —
/// `n+1` trechos pra `n` marcadores (alguns possivelmente vazios).
fn split_on_ph(masked: &str, n: usize) -> Vec<String> {
    let mut parts: Vec<String> = Vec::with_capacity(n + 1);
    let mut cur = String::new();
    let b: Vec<char> = masked.chars().collect();
    let mut i = 0;
    while i < b.len() {
        match read_ph(&b, i) {
            Some((idx, next)) if idx < n && idx == parts.len() => {
                parts.push(std::mem::take(&mut cur));
                i = next;
            }
            _ => {
                cur.push(b[i]);
                i += 1;
            }
        }
    }
    parts.push(cur);
    parts
}

// ---------- tradução do documento ----------

/// Traduz um documento inteiro preservando a estrutura.
///
/// `batch` recebe uma lista de textos e devolve a lista traduzida na mesma
/// ordem e no mesmo tamanho — é o ponto de injeção que deixa os testes rodarem
/// sem modelo. Pode ser chamada **duas vezes**: a segunda só com os trechos
/// cujos marcadores o modelo destruiu.
pub fn translate_doc<F>(doc: &str, is_md: bool, mut batch: F) -> Result<String, String>
where
    F: FnMut(Vec<String>) -> Result<Vec<String>, String>,
{
    let pieces = segment(doc, is_md);

    let inputs: Vec<String> = pieces
        .iter()
        .filter_map(|p| match p {
            Piece::Prose { masked, .. } => Some(masked.clone()),
            _ => None,
        })
        .collect();
    let n_inputs = inputs.len();
    let outs = batch(inputs)?;
    if outs.len() != n_inputs {
        return Err(format!(
            "tradutor devolveu {} trechos para {} enviados",
            outs.len(),
            n_inputs
        ));
    }

    // 1ª passada: tenta restaurar os marcadores.
    let prose: Vec<(&String, &Vec<String>)> = pieces
        .iter()
        .filter_map(|p| match p {
            Piece::Prose { masked, subs } => Some((masked, subs)),
            _ => None,
        })
        .collect();

    let mut done: Vec<Option<String>> = Vec::with_capacity(n_inputs);
    let mut retry_texts: Vec<String> = Vec::new();
    let mut retry_idx: Vec<usize> = Vec::new();

    for (k, (masked, subs)) in prose.iter().enumerate() {
        match unmask(&outs[k], subs) {
            Some(s) => done.push(Some(s)),
            None => {
                // Plano B: cada pedaço de prosa vai sozinho ao modelo.
                for part in split_on_ph(masked, subs.len()) {
                    if has_alpha(&part) {
                        retry_texts.push(part);
                    }
                }
                retry_idx.push(k);
                done.push(None);
            }
        }
    }

    // 2ª passada só se alguém falhou.
    if !retry_texts.is_empty() {
        let re = batch(retry_texts)?;
        let mut cur = 0usize;
        for &k in &retry_idx {
            let (masked, subs) = prose[k];
            let parts = split_on_ph(masked, subs.len());
            let mut s = String::new();
            for (i, part) in parts.iter().enumerate() {
                if has_alpha(part) {
                    s.push_str(re.get(cur).ok_or("plano B devolveu trechos de menos")?);
                    cur += 1;
                } else {
                    s.push_str(part);
                }
                if i < subs.len() {
                    s.push_str(&subs[i]);
                }
            }
            done[k] = Some(s);
        }
    }

    // Montagem final.
    let mut outv = String::with_capacity(doc.len() + 64);
    let mut k = 0usize;
    for p in &pieces {
        match p {
            Piece::Verbatim(s) => outv.push_str(s),
            Piece::Prose { masked, .. } => {
                outv.push_str(done[k].as_deref().unwrap_or(masked));
                k += 1;
            }
        }
    }
    Ok(outv)
}

/// Quantos trechos de prosa um documento gera (usado pra barra de progresso).
pub fn prose_count(doc: &str, is_md: bool) -> usize {
    segment(doc, is_md)
        .iter()
        .filter(|p| matches!(p, Piece::Prose { .. }))
        .count()
}

/// `.md`/`.markdown` liga o modo Markdown; o resto é texto puro.
///
/// Só o bench usa daqui: em produção quem decide é o front (`lib/docfile.ts`),
/// que é onde o usuário escolhe o arquivo — e lá a regra é testada no vitest.
#[cfg(test)]
pub fn is_markdown_path(path: &str) -> bool {
    let l = path.to_ascii_lowercase();
    l.ends_with(".md") || l.ends_with(".markdown") || l.ends_with(".mdown")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Tradutor falso: marca o texto de forma visível e reversível, sem tocar
    /// nos marcadores `#i#` (simula um modelo que se comporta).
    fn fake(v: Vec<String>) -> Result<Vec<String>, String> {
        Ok(v.into_iter().map(|s| format!("<{s}>")).collect())
    }

    /// Tradutor hostil: come TODOS os marcadores. Força o plano B.
    fn hostile(v: Vec<String>) -> Result<Vec<String>, String> {
        Ok(v.into_iter()
            .map(|s| {
                let cleaned: String = {
                    let b: Vec<char> = s.chars().collect();
                    let mut o = String::new();
                    let mut i = 0;
                    while i < b.len() {
                        match read_ph(&b, i) {
                            Some((_, next)) => i = next,
                            None => {
                                o.push(b[i]);
                                i += 1;
                            }
                        }
                    }
                    o
                };
                format!("<{cleaned}>")
            })
            .collect())
    }

    const DOC: &str = "\
# Título do documento

Um parágrafo com `código inline` e um [link](https://exemplo.com/a_b) no meio.

## Lista

- Primeiro item
- Segundo com **negrito** dentro
  - Aninhado

```rust
fn main() {
    println!(\"não traduzir isto\");
}
```

> Uma citação.

| Coluna A | Coluna B |
|---|---|
| célula | outra |

Fim.
";

    #[test]
    fn markdown_completo_mantem_a_estrutura() {
        let out = translate_doc(DOC, true, fake).unwrap();

        // Cabeçalhos: o "#" fica, o texto foi traduzido.
        assert!(out.contains("# <Título do documento>"), "{out}");
        assert!(out.contains("## <Lista>"), "{out}");

        // Bloco de código: byte a byte igual, nada marcado.
        assert!(
            out.contains("```rust\nfn main() {\n    println!(\"não traduzir isto\");\n}\n```"),
            "{out}"
        );

        // Inline e link: intactos, e o texto do link traduzido.
        assert!(out.contains("`código inline`"), "{out}");
        assert!(out.contains("](https://exemplo.com/a_b)"), "{out}");
        assert!(!out.contains("<https://exemplo.com"), "URL foi traduzida: {out}");

        // Lista: marcador e indentação preservados.
        assert!(out.contains("- <Primeiro item>"), "{out}");
        assert!(out.contains("  - <Aninhado>"), "{out}");
        assert!(out.contains("**"), "negrito sumiu: {out}");

        // Citação e tabela.
        assert!(out.contains("> <Uma citação.>"), "{out}");
        assert!(out.contains("|---|---|"), "separador da tabela mexido: {out}");
        assert!(out.contains("| <célula> | <outra> |"), "{out}");

        // Contagem de linhas idêntica — nenhuma linha nasceu ou sumiu.
        assert_eq!(out.lines().count(), DOC.lines().count(), "{out}");
    }

    #[test]
    fn plano_b_salva_a_estrutura_quando_o_modelo_come_o_marcador() {
        let line = "Use o `--force` para sobrescrever tudo.\n";
        // Modelo comportado: uma chamada só, marcador restaurado.
        let ok = translate_doc(line, true, fake).unwrap();
        assert!(ok.contains("`--force`"), "{ok}");

        // Modelo hostil: os marcadores somem, o plano B entra e a estrutura volta.
        let bad = translate_doc(line, true, hostile).unwrap();
        assert!(bad.contains("`--force`"), "plano B não restaurou: {bad}");
        assert!(bad.ends_with(".>\n") || bad.ends_with(">\n"), "{bad}");
    }

    #[test]
    fn plano_b_so_roda_quando_precisa() {
        let mut chamadas = 0;
        let _ = translate_doc(DOC, true, |v| {
            chamadas += 1;
            fake(v)
        })
        .unwrap();
        assert_eq!(chamadas, 1, "modelo comportado não deveria pedir 2ª passada");

        let mut chamadas = 0;
        let _ = translate_doc("Texto com `x` no meio.\n", true, |v| {
            chamadas += 1;
            hostile(v)
        })
        .unwrap();
        assert_eq!(chamadas, 2);
    }

    #[test]
    fn icamento_evita_marcador_no_caso_comum() {
        // Link sozinho na linha: `[`, `](url)` e o marcador de lista estão todos
        // nas pontas, então o modelo recebe só "manual" — nenhum marcador.
        let prose: Vec<_> = segment("- [manual](https://x.y/a_b)", true)
            .iter()
            .filter_map(|x| match x {
                Piece::Prose { masked, subs } => Some((masked.clone(), subs.len())),
                _ => None,
            })
            .collect();
        assert_eq!(prose, vec![("manual".to_string(), 0)]);
    }

    #[test]
    fn front_matter_e_codigo_indentado_ficam_intactos() {
        let doc = "---\ntitle: Olá\ntags: [a, b]\n---\n\nTexto normal.\n\n    codigo indentado aqui\n\nFim.\n";
        let out = translate_doc(doc, true, fake).unwrap();
        assert!(out.starts_with("---\ntitle: Olá\ntags: [a, b]\n---\n"), "{out}");
        assert!(out.contains("    codigo indentado aqui\n"), "{out}");
        assert!(out.contains("<Texto normal.>"), "{out}");
    }

    #[test]
    fn linhas_sem_letra_nao_vao_pro_modelo() {
        assert_eq!(prose_count("***\n---\n42\n[1]\n", true), 0);
        assert_eq!(prose_count("# Oi\n\n42\n", true), 1);
    }

    #[test]
    fn crlf_sobrevive() {
        let out = translate_doc("# Um\r\n\r\nDois.\r\n", true, fake).unwrap();
        assert_eq!(out, "# <Um>\r\n\r\n<Dois.>\r\n");
    }

    #[test]
    fn txt_preserva_linhas_em_branco_e_indentacao() {
        let doc = "Primeira linha.\n\n   Indentada.\n";
        let out = translate_doc(doc, false, fake).unwrap();
        assert_eq!(out, "<Primeira linha.>\n\n   <Indentada.>\n");
        // Em .txt o `#` NÃO é cabeçalho — vai junto pro modelo.
        let out = translate_doc("# não é título\n", false, fake).unwrap();
        assert_eq!(out, "<# não é título>\n");
    }

    #[test]
    fn autolink_e_tag_html_ficam_intactos() {
        let out = translate_doc("Veja <https://a.b/c> e <br/> aqui.\n", true, fake).unwrap();
        assert!(out.contains("<https://a.b/c>"), "{out}");
        assert!(out.contains("<br/>"), "{out}");
    }

    #[test]
    fn documento_sem_prosa_volta_identico() {
        let doc = "```\nx = 1\n```\n\n***\n\n| 1 | 2 |\n|---|---|\n";
        let out = translate_doc(doc, true, |v| {
            assert!(v.is_empty());
            Ok(vec![])
        })
        .unwrap();
        assert_eq!(out, doc);
    }

    /// Medição com modelo REAL (não roda no CI). Aponte
    /// `LOCALTRANSLATE_TEST_APPDATA` pra pasta com `translate/models/<perna>/`,
    /// `LOCALTRANSLATE_BENCH_FILE` pro documento e (opcional)
    /// `LOCALTRANSLATE_BENCH_DIR` pra direção (padrão `pt-en`).
    ///
    /// Imprime bytes, trechos, tempo, throughput e — o número que interessa —
    /// quantos trechos precisaram do plano B (marcador destruído pelo modelo).
    #[test]
    fn bench_documento_real() {
        let (Ok(app_data), Ok(file)) = (
            std::env::var("LOCALTRANSLATE_TEST_APPDATA"),
            std::env::var("LOCALTRANSLATE_BENCH_FILE"),
        ) else {
            eprintln!("bench pulado (defina LOCALTRANSLATE_TEST_APPDATA e LOCALTRANSLATE_BENCH_FILE)");
            return;
        };
        let dir = std::env::var("LOCALTRANSLATE_BENCH_DIR").unwrap_or_else(|_| "pt-en".into());
        let app_data = std::path::PathBuf::from(app_data);
        let doc = std::fs::read_to_string(&file).expect("arquivo do bench");
        let is_md = is_markdown_path(&file);
        let tr = crate::translate::Translator::default();

        let total = prose_count(&doc, is_md);
        eprintln!(
            "bench: {} ({} bytes, {} trechos, md={}) direção {}",
            file,
            doc.len(),
            total,
            is_md,
            dir
        );

        let t0 = std::time::Instant::now();
        let mut passadas = 0usize;
        let mut enviados = 0usize;
        let out = translate_doc(&doc, is_md, |batch| {
            passadas += 1;
            enviados += batch.len();
            let n = batch.len();
            let mut acc = Vec::with_capacity(n);
            for (i, group) in batch.chunks(8).enumerate() {
                acc.extend(crate::translate::translate_texts(
                    &app_data,
                    &tr,
                    &dir,
                    group.to_vec(),
                )?);
                if i % 25 == 0 {
                    eprintln!("  … {}/{} em {:?}", acc.len(), n, t0.elapsed());
                }
            }
            Ok(acc)
        })
        .expect("tradução falhou");
        let dt = t0.elapsed();

        eprintln!(
            "RESULTADO: {} bytes em {:?} = {:.1} KB/min | {:.2} trechos/s | passadas={} trechos enviados={} (plano B={} extras)",
            doc.len(),
            dt,
            (doc.len() as f64 / 1024.0) / (dt.as_secs_f64() / 60.0),
            total as f64 / dt.as_secs_f64(),
            passadas,
            enviados,
            enviados.saturating_sub(total),
        );

        // A prova estrutural no documento real: mesma contagem de linhas e todo
        // bloco de código idêntico ao original.
        assert_eq!(out.lines().count(), doc.lines().count(), "linhas mudaram");
        let fences_in = doc.matches("```").count();
        let fences_out = out.matches("```").count();
        assert_eq!(fences_in, fences_out, "cercas de código mudaram");
        std::fs::write(format!("{file}.traduzido"), &out).ok();
    }

    #[test]
    fn tarefa_e_lista_numerada() {
        let out = translate_doc("1. Um item\n- [ ] tarefa\n- [x] feita\n", true, fake).unwrap();
        assert!(out.contains("1. <Um item>"), "{out}");
        assert!(out.contains("- [ ] <tarefa>"), "{out}");
        assert!(out.contains("- [x] <feita>"), "{out}");
    }
}
