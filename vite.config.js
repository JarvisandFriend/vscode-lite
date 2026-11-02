import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm';

export default defineConfig(({ mode }) => {
  const base = process.env.BASE_URL || (mode === 'production' ? '/vscode-lite/' : '/');
  return {
    base,
    plugins: [
      react(),
      monacoEditorPlugin({
        customDistPath: (root, outDir) => path.join(root, outDir, 'monacoeditorwork'),
      }),
    ],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/gh-oauth': {
          target: 'https://github.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/gh-oauth/, ''),
        },
      },
    },
    build: { outDir: 'dist', emptyOutDir: true },
  };
});
