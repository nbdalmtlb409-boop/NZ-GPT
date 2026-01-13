import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // تحميل المتغيرات البيئية من ملف .env
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    // هام جداً: يجعل المسارات نسبية لتعمل عند فتح index.html مباشرة أو على استضافات فرعية
    base: './', 
    define: {
      // حقن قيمة API Key مباشرة في الكود النهائي
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // حماية إضافية لضمان عدم حدوث خطأ عند استدعاء process.env
      'process.env': JSON.stringify({ API_KEY: env.API_KEY })
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      assetsDir: 'assets',
      sourcemap: false, // تعطيل خرائط المصدر لتقليل الحجم وتحسين الأمان
      rollupOptions: {
        output: {
          // تنظيم الملفات داخل مجلد assets لضمان عدم تبعثر الملفات
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    }
  };
});