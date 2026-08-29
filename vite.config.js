import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor-esm';

export default defineConfig({
  plugins: [react(), monacoEditorPlugin({})],
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true },
});
