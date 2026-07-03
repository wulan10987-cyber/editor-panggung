import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Ini yang membuat preview bisa dibuka di Codespaces
    strictPort: true,
    hmr: {
      clientPort: 443
    }
  }
})