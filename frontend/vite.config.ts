import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 서버: 127.0.0.1:5173 (백엔드 CORS 기본 허용 origin)
// /api 요청은 백엔드(127.0.0.1:3001)로 프록시한다.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false },
    },
  },
  preview: { host: '127.0.0.1', port: 4173 },
});
