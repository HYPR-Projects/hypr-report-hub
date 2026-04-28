import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: {
      "Content-Security-Policy": "img-src * data: blob:; default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
    }
  }
})