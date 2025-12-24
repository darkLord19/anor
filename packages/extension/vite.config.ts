import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'fs';
import { readFileSync as readFile } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        'content-linkedin': resolve(__dirname, 'src/content/linkedin.ts'),
        'content-whatsapp': resolve(__dirname, 'src/content/whatsapp.ts'),
        'content-webapp': resolve(__dirname, 'src/content/webapp.ts'),
        'sidepanel/index': resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep sidepanel JS in sidepanel folder
          if (chunkInfo.name === 'sidepanel/index') {
            return 'sidepanel/index.js';
          }
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Output sidepanel HTML to sidepanel/index.html
          const originalPath = assetInfo.originalFileName || '';
          if (assetInfo.name === 'index.html' && (originalPath.includes('sidepanel') || originalPath.includes('src/sidepanel'))) {
            return 'sidepanel/index.html';
          }
          // Output sidepanel CSS
          if (assetInfo.name && assetInfo.name.endsWith('.css') && originalPath.includes('sidepanel')) {
            return 'sidepanel/styles.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@anor/ui': resolve(__dirname, '../ui'),
    },
  },
  plugins: [
    {
      name: 'inject-ui-styles',
      transformIndexHtml(html) {
        // Inject UI styles into sidepanel HTML
        if (html.includes('sidepanel')) {
          const uiDistPath = resolve(__dirname, '../ui/dist');
          let fullStyles = '';
          
          // Read and combine all UI CSS files
          const variablesPath = resolve(uiDistPath, 'variables.css');
          const basePath = resolve(uiDistPath, 'base.css');
          const componentsPath = resolve(uiDistPath, 'components.css');
          
          if (existsSync(variablesPath)) {
            fullStyles += readFile(variablesPath, 'utf-8') + '\n';
          }
          if (existsSync(basePath)) {
            fullStyles += readFile(basePath, 'utf-8') + '\n';
          }
          if (existsSync(componentsPath)) {
            fullStyles += readFile(componentsPath, 'utf-8') + '\n';
          }
          
          // Read extension-specific styles
          const extensionStylesPath = resolve(__dirname, 'src/sidepanel/styles.css');
          if (existsSync(extensionStylesPath)) {
            const extensionStylesContent = readFile(extensionStylesPath, 'utf-8');
            // Extract only the extension-specific styles (after the @import)
            const extensionOnly = extensionStylesContent.replace(/@import[^;]+;?\s*/g, '').trim();
            fullStyles += extensionOnly;
          }
          
          // Replace the styles.css link with inline styles
          return html.replace(
            /<link[^>]*href="[^"]*styles\.css"[^>]*>/,
            `<style>${fullStyles}</style>`
          );
        }
        return html;
      },
      transform(code, id) {
        // Replace CSS imports in sidepanel styles.css
        if (id.includes('sidepanel/styles.css')) {
          const uiStylesPath = resolve(__dirname, '../ui/dist/styles.css');
          if (existsSync(uiStylesPath)) {
            const uiStyles = readFile(uiStylesPath, 'utf-8');
            // Add extension-specific styles
            const extensionStyles = `
#app {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.screen {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Login Screen */
.login-container {
  width: 100%;
  max-width: 400px;
  margin: auto;
  padding: 2.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: calc(var(--radius) + 4px);
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.9375rem;
  margin-bottom: 2rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message.show {
  display: block;
}

.auth-toggle {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.privacy {
  margin-top: 1.5rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

/* Chat Screen */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-email {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.sign-out-button {
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-sans);
}

.sign-out-button:hover {
  color: var(--text-primary);
  border-color: var(--border-accent);
}

.container {
  flex: 1;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
  overflow-y: auto;
}

.ask-form {
  margin-bottom: 2rem;
}

.input-wrapper {
  display: flex;
  gap: 0.75rem;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: calc(var(--radius) + 4px);
  transition: all 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.query-input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 1rem;
  font-family: var(--font-sans);
}

.query-input:focus {
  outline: none;
}

.query-input::placeholder {
  color: var(--text-muted);
}

.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--accent-gradient);
  border: none;
  border-radius: var(--radius);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  transform: scale(1.05);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.answer-card {
  padding: 1.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
}

.answer-card.insufficient {
  text-align: center;
  padding: 2rem;
}

.answer-text {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--text-primary);
}

.hints {
  margin-top: 2rem;
}

.hints h3 {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
  margin-bottom: 1rem;
}

.hint-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hint {
  text-align: left;
  padding: 1rem 1.25rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-sans);
}

.hint:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-accent);
  color: var(--text-primary);
}
`;
            return uiStyles + extensionStyles;
          }
        }
        return code;
      },
    },
    {
      name: 'copy-manifest',
      closeBundle() {
        const distPath = resolve(__dirname, 'dist');
        const manifestPath = resolve(__dirname, 'manifest.json');
        
        // Copy manifest.json
        if (existsSync(manifestPath)) {
          copyFileSync(manifestPath, resolve(distPath, 'manifest.json'));
        }
        
        // Copy icons if they exist
        const iconsPath = resolve(__dirname, 'icons');
        const distIconsPath = resolve(distPath, 'icons');
        if (existsSync(iconsPath)) {
          if (!existsSync(distIconsPath)) {
            mkdirSync(distIconsPath, { recursive: true });
          }
          const files = readdirSync(iconsPath);
          for (const file of files) {
            const srcFile = resolve(iconsPath, file);
            const destFile = resolve(distIconsPath, file);
            if (statSync(srcFile).isFile()) {
              copyFileSync(srcFile, destFile);
            }
          }
        }
        
        // Fix sidepanel HTML script paths to use relative paths for Chrome extension compatibility
        // Check both possible locations
        const sidepanelHtmlPath = resolve(distPath, 'sidepanel/index.html');
        const sidepanelHtmlPathAlt = resolve(distPath, 'src/sidepanel/index.html');
        let htmlPath = existsSync(sidepanelHtmlPath) ? sidepanelHtmlPath : sidepanelHtmlPathAlt;
        
        if (existsSync(htmlPath)) {
          let htmlContent = readFileSync(htmlPath, 'utf-8');
          // Replace script src paths - handle /sidepanel/index.js pattern
          htmlContent = htmlContent.replace(/src="\/sidepanel\/([^"]+)"/g, 'src="./$1"');
          htmlContent = htmlContent.replace(/src="\/src\/sidepanel\/([^"]+)"/g, 'src="./$1"');
          // Replace absolute paths for chunks and assets
          htmlContent = htmlContent.replace(/src="\/(chunks\/[^"]+)"/g, 'src="../$1"');
          htmlContent = htmlContent.replace(/src="\/(assets\/[^"]+)"/g, 'src="../$1"');
          htmlContent = htmlContent.replace(/href="\/(chunks\/[^"]+)"/g, 'href="../$1"');
          htmlContent = htmlContent.replace(/href="\/(assets\/[^"]+)"/g, 'href="../$1"');
          // Fix CSS path to use relative path (handle both absolute and relative)
          htmlContent = htmlContent.replace(/href="\/sidepanel\/styles\.css"/g, 'href="./styles.css"');
          htmlContent = htmlContent.replace(/href="\.\.\/assets\/(index-[^"]+\.css)"/g, 'href="./styles.css"');
          
          // If HTML is in wrong location, move it
          if (htmlPath === sidepanelHtmlPathAlt) {
            const targetDir = resolve(distPath, 'sidepanel');
            if (!existsSync(targetDir)) {
              mkdirSync(targetDir, { recursive: true });
            }
            writeFileSync(sidepanelHtmlPath, htmlContent);
            // Remove old file and directory if empty
            try {
              const oldFile = resolve(distPath, 'src/sidepanel/index.html');
              if (existsSync(oldFile)) {
                unlinkSync(oldFile);
                // Try to remove empty directories
                const sidepanelDir = resolve(distPath, 'src/sidepanel');
                const srcDir = resolve(distPath, 'src');
                try {
                  if (existsSync(sidepanelDir) && readdirSync(sidepanelDir).length === 0) {
                    rmdirSync(sidepanelDir);
                  }
                  if (existsSync(srcDir) && readdirSync(srcDir).length === 0) {
                    rmdirSync(srcDir);
                  }
                } catch {}
              }
            } catch {}
          } else {
            writeFileSync(htmlPath, htmlContent);
          }
        }
      },
    },
  ],
});
