# LocalTranslate

Tradutor **100% offline** (pt-BR · español · english) — sem nuvem, sem conta, sem
telemetria. Parte da suíte **Local**.

O motor são modelos **Marian/OPUS-MT** da [Helsinki-NLP](https://github.com/Helsinki-NLP/Opus-MT)
rodando no [candle](https://github.com/huggingface/candle) (CPU, Rust puro — **sem
sidecar e sem servidor**). Os modelos são baixados sob demanda e ficam em
`app_data`; nada é enviado pra fora da máquina.

## Recursos

- Duas caixas origem → destino, entre os 3 idiomas (6 direções).
- **Detecção automática** do idioma de origem (heurística leve) com sugestão de inverter.
- Inverter idiomas, copiar resultado, `Ctrl+Enter` para traduzir.
- Abrir arquivo `.txt`/`.md` direto na caixa de origem.
- **Traduzir arquivo `.txt`/`.md` inteiro** preservando a estrutura (v0.4) — ver abaixo.
- **Janela rápida por atalho global** (v0.4): o atalho abre uma janelinha já com o
  texto da área de transferência; `Ctrl+Enter` traduz, `Esc` fecha.
- **Histórico local** (SQLite) — reabra qualquer tradução com um clique.
- **Gerenciador de modelos**: baixe só os pares que usar, com progresso e checksum
  conferido; remova para liberar disco. Português ↔ Espanhol reaproveita os modelos
  via inglês (pivô), sem download próprio.
- Tema claro/escuro/sistema.

## Traduzir arquivo preservando a estrutura

Um tradutor neural recebe texto e devolve texto: jogar um Markdown inteiro nele
traduz o `#` do cabeçalho, mexe na URL do link e reescreve o bloco de código. Por
isso o documento é **fatiado antes** (`src-tauri/src/md.rs`): o modelo só vê prosa.

Saem intactos, byte a byte: blocos de código cercados e indentados, front matter
YAML, URLs de links e imagens, trechos `inline`, marcadores `**`/`_`/`~~`, tags
HTML e autolinks, marcadores de lista/tarefa/citação, separadores de tabela,
linhas horizontais e as quebras de linha (inclusive CRLF).

Trecho protegido no meio de uma frase vira um marcador (`#0#`) mandado ao modelo
junto com a prosa. Marcador é **aposta**: o modelo pode comê-lo. A restauração é
verificada e, quando falha, o trecho é retraduzido **em pedaços** — pior tradução,
estrutura garantida. O contador de "plano B" aparece na medição do bench.

### Custo (medido, não estimado)

Marian em CPU não é rápido. Números da máquina de desenvolvimento (pt→en,
release com LTO) estão em `docs`/no commit da v0.4.0 — a regra prática é que
**arquivo grande leva minutos a horas**, então a tradução roda fora da thread da
UI (comando `async` = pool do Tauri), com progresso por trecho, estimativa de
tempo e botão de cancelar.

Limitação assumida: existe **um modelo carregado por perna**, protegido por
mutex. Enquanto um documento roda, uma tradução avulsa (caixa principal ou
janela rápida) **espera a vez** — a janela não congela, mas o resultado demora.
Paralelizar exigiria uma 2ª cópia do modelo na RAM (~300 MB por perna), o que
não vale pro caso de uso.

## Janela rápida (atalho global)

Padrão da suíte reusado do LocalClip (bandeja + `global-shortcut` +
`single-instance`), com janela própria (`quick.html`) porque a principal é um app
inteiro. O atalho é **configurável** (padrão `ctrl+shift+t`) e o erro de registro
— combinação já tomada por outro app — aparece na tela de configurações, em vez
de virar "apertei e não aconteceu nada".

Fechar a janela principal **sai do app** por padrão; ligar "manter na bandeja"
nas configurações é o que mantém o atalho valendo o dia inteiro.

## Idiomas e pivô

Há 4 modelos base — `en→pt`, `pt→en`, `en→es`, `es→en`. Português ↔ Espanhol é
feito **pivotando pelo inglês** (duas pernas), porque a Helsinki-NLP não publica um
par direto pt↔es.

Os bundles convertidos (safetensors f16 + tokenizer) são hospedados na release
[`v1` do repo `LocalZIM-models`](https://github.com/Anon5T4R/LocalZIM-models/releases/tag/v1),
compartilhados com o LocalZIM.

## Desenvolvimento

```bash
npm install
npm run tauri dev     # app (precisa do toolchain Rust)
npm run dev           # só o front, no navegador (porta 1454)
npm test              # testes do front (vitest)
```

Testes do back:

```bash
cd src-tauri && cargo test
```

Teste de tradução ponta a ponta com modelo real (não roda no CI): aponte
`LOCALTRANSLATE_TEST_APPDATA` pra uma pasta com `translate/models/en-es/` preenchida.

Medição de documento inteiro com modelo real (imprime KB/min, trechos/s e quantos
trechos caíram no plano B):

```bash
cd src-tauri
LOCALTRANSLATE_TEST_APPDATA=.../com.localtranslate.app \
LOCALTRANSLATE_BENCH_FILE=.../grande.md \
LOCALTRANSLATE_BENCH_DIR=pt-en \
cargo test --profile bench-doc bench_documento_real -- --nocapture --test-threads=1
```

`bench-doc` é o `release` **sem LTO**: o link com LTO fat do candle+tokenizers
passa de 30 min, o que inviabiliza medir. Quem manda no tempo de inferência é o
`opt-level = 3`, então o número sai um **piso conservador** do release real.

## Build / Release

`tag v*` dispara o GitHub Actions → instalador **NSIS (Windows)** + **AppImage (Linux)**.

## Licença

MIT. Créditos aos modelos OPUS-MT (Helsinki-NLP) e ao candle (Hugging Face).
