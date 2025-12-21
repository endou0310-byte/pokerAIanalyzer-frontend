// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "/",              // ← 独自ドメインでは必ず /
  build: {
    outDir: "docs",
  },
})


