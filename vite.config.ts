import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // تحميل المتغيرات البيئية بشكل آمن
  const env = loadEnv(mode, '.', '');
  
  return {
    plugins: [react()],
    base: './', 
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // تعريف كائن فارغ كإحتياطي لتجنب أخطاء undefined
      'process.env': JSON.stringify({ API_KEY: env.API_KEY })
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'lucide-react', '@google/genai']
          }
        }
      }
    }
  };
});