// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',                // ★ ここだけ変更（ルート配信用）
  build: {
    outDir: 'docs',         // ここはそのまま（docs にビルド）
  },
})
