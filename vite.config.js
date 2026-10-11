import {defineConfig} from 'vite';
export default defineConfig({
  base:'/Image2Other/',
  build:{rollupOptions:{output:{entryFileNames:'assets/[name].js',chunkFileNames:'assets/[name].js',assetFileNames:'assets/[name][extname]'}}},
  worker:{rollupOptions:{output:{entryFileNames:'assets/trace.worker.js',chunkFileNames:'assets/[name].js'}}},
  server:{port:5178}, preview:{port:4178}
});
