import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        login:  resolve(__dirname, 'login.html'),   // ← index ではなく login
        record: resolve(__dirname, 'record.html'),
        history: resolve(__dirname, 'history.html'), // ← 追加
      },
    },
  },
})
