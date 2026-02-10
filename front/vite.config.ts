import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // 将 API 请求代理到后端，解决开发环境的跨域问题
          '/auth': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
          '/users': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
          '/actions': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
          '/videos': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
          '/recognize': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
          '/scores': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
          '/uploads': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
