# @dotor/ui

Shared UI package for Dotor applications. Contains common styles, CSS variables, and utility functions used across webapp and extension.

## Structure

- `variables.css` - CSS custom properties (design tokens)
- `base.css` - Base styles and resets
- `components.css` - Reusable component styles
- `styles.css` - Main entry point (imports all above)
- `utils.ts` - TypeScript utility functions

## Usage

### In Next.js (webapp)

```css
/* In globals.css */
@import '@dotor/ui/styles';
```

### In Vite (extension)

The extension uses a Vite plugin to inject the styles during build. The styles are automatically included.

### Importing utilities

```typescript
import { showMessage, hideMessage, formatEmail } from '@dotor/ui';
```

## Building

```bash
pnpm build
```

This will:
1. Compile TypeScript to `dist/`
2. Copy CSS files to `dist/`

## Design Tokens

All design tokens are defined in `variables.css`:

- Colors: `--bg-primary`, `--text-primary`, `--accent-primary`, etc.
- Spacing: `--radius`
- Typography: `--font-sans`, `--font-mono`

## Components

The package provides CSS classes for common components:

- `.primary-button` - Primary action button
- `.secondary-button` - Secondary button
- `.google-button` - Google OAuth button
- `.input` - Form input
- `.card` - Card container
- `.message` - Status message (with `.error`, `.success` modifiers)
- `.logo` - Logo component
- `.spinner` - Loading spinner

