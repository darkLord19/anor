# Extension Troubleshooting

## CSS Not Loading / UI Looks Broken

If the extension UI looks unstyled or broken:

1. **Rebuild the extension:**
   ```bash
   cd packages/extension
   pnpm build
   ```

2. **Reload the extension in Chrome:**
   - Go to `chrome://extensions/`
   - Find "Dotor" extension
   - Click the reload icon (circular arrow) on the extension card
   - Or toggle it off and on

3. **Clear browser cache:**
   - Close all Chrome windows
   - Reopen Chrome
   - Reload the extension

4. **Check the side panel:**
   - Click the extension icon in the toolbar
   - The side panel should open on the right side
   - If it doesn't open, check the browser console for errors

5. **Verify CSS is included:**
   - Right-click in the side panel → "Inspect"
   - In DevTools, check the `<head>` section
   - You should see a `<style>` tag with CSS variables and styles
   - If the style tag is missing or empty, rebuild the extension

## Common Issues

### Extension icon doesn't open side panel
- Make sure you're using Chrome 114+ (side panel API requirement)
- Check that `sidePanel` permission is in manifest.json
- Verify background.js is running (check service worker in chrome://extensions/)

### Styles look wrong
- Make sure `packages/ui` is built: `cd packages/ui && pnpm build`
- Rebuild extension: `cd packages/extension && pnpm build`
- Hard reload the extension in Chrome

### Authentication not working
- Check that environment variables are set in `.env` file
- Verify Supabase URL and keys are correct
- Check browser console for authentication errors

