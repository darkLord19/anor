# Dotor Extension

Chrome extension for Dotor - Privacy-first personal assistant.

## Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in this directory with:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
   VITE_API_URL=http://localhost:3001
   ```

3. **Generate icons:**
   ```bash
   node generate-icons.js
   ```
   Or manually create PNG icons at:
   - `icons/icon16.png`
   - `icons/icon48.png`
   - `icons/icon128.png`

4. **Build the extension:**
   ```bash
   pnpm build
   ```

5. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Development

- `pnpm dev` - Build in watch mode
- `pnpm build` - Build for production
- `pnpm lint` - Type check

## Troubleshooting

- If icons are missing, Chrome will show a default icon (this is fine for development)
- Make sure environment variables are set before building
- Check browser console for errors in popup and background scripts

