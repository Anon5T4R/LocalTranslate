import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Lição da suíte: uma única cópia do React (senão hooks quebram).
  resolve: {
    dedupe: ["react", "react-dom"],
  },

  // Duas páginas: o app (`index.html`) e a janelinha do atalho global
  // (`quick.html`, janela `quick`). Sem declarar as duas entradas, o build só
  // emitiria a index e a janelinha abriria EM BRANCO no instalador — e
  // funcionaria o tempo todo em `tauri dev`, que serve o projeto inteiro pelo
  // Vite. É o tipo de quebra que só aparece depois do release.
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        quick: "quick.html",
      },
    },
  },

  // Opções do Vite ajustadas pro Tauri (só em `tauri dev`/`tauri build`).
  clearScreen: false,
  server: {
    // Porta única do LocalTranslate na suíte (LocalDraw=1452, este=1454). O Tauri
    // não tem fallback de porta — devUrl e esta porta têm que bater.
    port: 1454,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1455,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
