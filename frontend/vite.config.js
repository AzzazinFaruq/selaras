import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Saat development, /api diteruskan ke backend Go supaya frontend dan API
// tetap satu origin (cookie SameSite=Strict, tanpa CORS), sama seperti produksi.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
})
