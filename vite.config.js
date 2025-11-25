import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ★GitHub Pages (https://endou0310-byte.github.io/pokerAIanalyzer-frontend/)
  //   で正しいパスになるように、base をリポジトリ名に合わせる
  base: "/pokerAIanalyzer-frontend/",
});
