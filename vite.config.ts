import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: 'index.html',
        escanerDocumentos: 'escaner-documentos.html',
        firmarPdfGratis: 'firmar-pdf-gratis.html',
        fotoAWord: 'foto-a-word.html',
        alternativaCamscanner: 'alternativa-camscanner.html',
      },
      output: {
        manualChunks: {
          pdf: ['pdf-lib', 'pdfjs-dist'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
