# LocalTranslate

Tradutor **100% offline** (pt-BR · español · english) — sem nuvem, sem conta, sem
telemetria. Parte da suíte **Local**.

O motor são modelos **Marian/OPUS-MT** da [Helsinki-NLP](https://github.com/Helsinki-NLP/Opus-MT)
rodando no [candle](https://github.com/huggingface/candle) (CPU, Rust puro — **sem
sidecar e sem servidor**). Os modelos são baixados sob demanda e ficam em
`app_data`; nada é enviado pra fora da máquina.

## Recursos (v0.1)

- Duas caixas origem → destino, entre os 3 idiomas (6 direções).
- **Detecção automática** do idioma de origem (heurística leve) com sugestão de inverter.
- Inverter idiomas, copiar resultado, `Ctrl+Enter` para traduzir.
- Abrir arquivo `.txt`/`.md` direto na caixa de origem.
- **Histórico local** (SQLite) — reabra qualquer tradução com um clique.
- **Gerenciador de modelos**: baixe só os pares que usar, com progresso e checksum
  conferido; remova para liberar disco. Português ↔ Espanhol reaproveita os modelos
  via inglês (pivô), sem download próprio.
- Tema claro/escuro/sistema.

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

## Build / Release

`tag v*` dispara o GitHub Actions → instalador **NSIS (Windows)** + **AppImage (Linux)**.

## Licença

MIT. Créditos aos modelos OPUS-MT (Helsinki-NLP) e ao candle (Hugging Face).
