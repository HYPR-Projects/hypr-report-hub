import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      "Content-Security-Policy": "img-src * data: blob:; default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;"
    }
  }
})