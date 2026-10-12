import { defineConfig } from 'vite';

// Relative base so the built site works from any folder or GitHub Pages path.
export default defineConfig({
  base: './',
  build: {
    // Inline the guitar samples (about 17 KB each) as data URIs, so guitar-theory.html
    // works on its own from Finder with no internet connection.
    assetsInlineLimit: 64 * 1024,
  },
});
