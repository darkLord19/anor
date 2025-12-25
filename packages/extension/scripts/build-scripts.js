import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

async function buildScripts() {
  console.log('Building background script...');
  await build({
    configFile: false,
    root: rootDir,
    build: {
      emptyOutDir: false,
      outDir: 'dist',
      lib: {
        entry: resolve(rootDir, 'src/background.ts'),
        name: 'background',
        fileName: () => 'background.js',
        formats: ['iife'],
      },
      resolve: {
        alias: {
          '@': resolve(rootDir, 'src'),
          '@anor/ui': resolve(rootDir, '../ui'),
        },
      },
    },
  });

  const contentScripts = [
    { name: 'content-linkedin', path: 'src/content/linkedin.ts' },
    { name: 'content-whatsapp', path: 'src/content/whatsapp.ts' },
    { name: 'content-webapp', path: 'src/content/webapp.ts' },
  ];

  for (const script of contentScripts) {
    console.log(`Building ${script.name}...`);
    await build({
      configFile: false,
      root: rootDir,
      build: {
        emptyOutDir: false,
        outDir: 'dist',
        lib: {
          entry: resolve(rootDir, script.path),
          name: script.name.replace(/-/g, '_'),
          fileName: () => `${script.name}.js`,
          formats: ['iife'],
        },
        resolve: {
          alias: {
            '@': resolve(rootDir, 'src'),
            '@anor/ui': resolve(rootDir, '../ui'),
          },
        },
      },
    });
  }
}

buildScripts().catch(console.error);
