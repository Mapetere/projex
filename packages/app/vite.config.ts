import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],

    // Prevent vite from obscuring rust errors
    clearScreen: false,

    server: {
        port: 1420,
        strictPort: true,
        watch: {
            ignored: ['**/src-tauri/**'],
        },
    },

    build: {
        // Tauri uses Chromium on Windows and WebKit on macOS/Linux
        target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
        // Don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        // Produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
    },
});
