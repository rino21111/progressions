// After `vite build`, inline the JS and CSS into one HTML file that opens
// straight from Finder (no dev server or Node needed to use it).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/, (_, file) => {
  const js = readFileSync(join(dist, file), 'utf8').replaceAll('</script', '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/, (_, file) => {
  return `<style>${readFileSync(join(dist, file), 'utf8')}</style>`;
});

if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error('Some assets were not inlined');
writeFileSync('guitar-theory.html', html);
console.log('Wrote guitar-theory.html');
