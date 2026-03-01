import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const backendOrigin = env.VITE_BACKEND_ORIGIN || 'http://localhost:3000'

  return {
    plugins: [vue()],
    server: {
      proxy: {
        '/api': {
          target: backendOrigin,
          changeOrigin: true
        },
        '/workflow': {
          target: backendOrigin,
          changeOrigin: true
        }
      }
    }
  }
})