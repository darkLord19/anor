# Installing the Anor Chrome Extension

## Prerequisites

1. **Environment Variables**: Create a `.env` file in this directory:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
   VITE_API_URL=http://localhost:3001
   ```

2. **Build the extension:**
   ```bash
   pnpm build
   ```

## Installation Steps

1. **Open Chrome Extensions:**
   - Navigate to `chrome://extensions/`
   - Or: Chrome Menu → Extensions → Manage Extensions

2. **Enable Developer Mode:**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension:**
   - Click "Load unpacked"
   - Select the `dist` folder inside `packages/extension/`
   - The extension should now appear in your extensions list

4. **Verify Installation:**
   - Click the extension icon in the Chrome toolbar
   - You should see the Anor popup
   - If you see errors, check the browser console (F12) and extension service worker logs

## Troubleshooting

### Extension not loading
- Make sure you selected the `dist` folder, not the `src` folder
- Check that all files are present in `dist/`:
  - `manifest.json`
  - `background.js`
  - `popup/index.html`
  - `popup/index.js`
  - `content-linkedin.js`
  - `content-whatsapp.js`
  - `icons/` folder with PNG files

### Authentication errors
- Verify your `.env` file has correct Supabase credentials
- Rebuild the extension after changing `.env` variables
- Check the browser console for specific error messages

### Content scripts not working
- Make sure you're on the correct pages:
  - LinkedIn: `https://www.linkedin.com/messaging/*`
  - WhatsApp: `https://web.whatsapp.com/*`
- Check the extension service worker logs in `chrome://extensions/` → Details → Service worker

### Icons missing
- Run `node generate-icons.js` to create placeholder icons
- Or create your own PNG files at the required sizes (16x16, 48x48, 128x128)

## Development

- `pnpm dev` - Build in watch mode (rebuilds on file changes)
- `pnpm build` - Build for production
- After making changes, reload the extension in Chrome (click the reload icon on the extension card)

