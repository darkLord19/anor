import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const contentScripts = [
  { name: 'content-linkedin', path: 'src/content/linkedin.ts' },
  { name: 'content-whatsapp', path: 'src/content/whatsapp.ts' },
  { name: 'content-webapp', path: 'src/content/webapp.ts' },
  { name: 'content-interceptor', path: 'src/content/interceptor.ts' },
];

console.log('Building content scripts...');

async function run() {
  for (const script of contentScripts) {
    console.log(`Building ${script.name}...`);
    await build({
      root,
      configFile: false,
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(root, script.path),
          output: {
            format: 'iife',
            entryFileNames: `${script.name}.js`,
            inlineDynamicImports: true,
          },
        },
        minify: process.env.NODE_ENV === 'production',
      },
      resolve: {
        alias: {
          '@': resolve(root, 'src'),
          '@dotor/ui': resolve(root, '../ui'),
        },
      },
    });
  }
  console.log('Content scripts built.');
}

run().catch(console.error);
