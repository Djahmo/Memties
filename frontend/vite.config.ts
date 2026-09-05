import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  server: {
		host: '0.0.0.0',
		port: 5174,
    strictPort: true,
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001' },
  },
  plugins: [
    react(),
    UnoCSS(),
  ],
})
