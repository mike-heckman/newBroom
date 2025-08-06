import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Set the root to your source code directory
  root: 'src',
  // The public directory is relative to the project root, not the 'src' root.
  publicDir: '../public',
  build: {
    // Output directory is relative to the project root
    outDir: resolve(process.cwd(), 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Paths must be absolute or relative to the project root.
        options: resolve(process.cwd(), 'src/options.html'),
        popup: resolve(process.cwd(), 'src/popup.html'),
        background: resolve(process.cwd(), 'src/background.js'),
      },
      output: {
        // Place the background script directly in the output directory
        entryFileNames: (chunkInfo) => (chunkInfo.name === 'background' ? '[name].js' : 'assets/[name].js'),
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
