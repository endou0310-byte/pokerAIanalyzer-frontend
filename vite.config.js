// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/pokerAIanalyzer-frontend/', // ← リポジトリ名に合わせる
  build: {
    outDir: 'docs', // ← ビルド出力を docs に変更
  },
})
