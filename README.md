# Anor

Privacy-first personal assistant that searches your emails, calendar, and messages without storing any data.

## Features

- **Gmail & Calendar Search**: Natural language queries over your email and schedule
- **LinkedIn & WhatsApp**: Browser extension for message search
- **AI-Powered Answers**: Synthesized responses with cited sources
- **Zero Storage**: All data processed in-memory only

## Architecture

```
anor/
├── packages/
│   ├── backend/      # Fastify API + OpenRouter + Google APIs
│   ├── extension/    # Chrome MV3 extension
│   └── webapp/       # Next.js web app
└── scripts/          # E2E tests & privacy audits
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project with auth enabled
- OpenRouter API key
- Google OAuth credentials

### Setup

1. Clone and install:
```bash
git clone <repo>
cd anor
pnpm install
```

2. Configure environment variables:

**Backend** (`packages/backend/.env`):
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenRouter (LLM)
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-4-turbo-preview
APP_URL=http://localhost:3000

# Google OAuth (for Gmail/Calendar access)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3001/google/callback

# Token encryption (generate with: openssl rand -base64 32)
TOKEN_ENCRYPTION_SECRET=your_random_32_byte_secret

# Web app URL (for OAuth redirects)
WEBAPP_URL=http://localhost:3000
```

**Web App** (`packages/webapp/.env.local`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**Extension** (`packages/extension/.env`):
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_API_URL=http://localhost:3001
```

3. Start development:
```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Test

```bash
# E2E tests
pnpm test:e2e

# Privacy audit
pnpm audit:privacy
```

## Privacy Guarantees

- ✅ No query content stored in database
- ✅ No snippet/message content logged
- ✅ No background sync jobs
- ✅ Extension performs read-only DOM access
- ✅ 6-month date cap enforced on Gmail queries
- ✅ All data processed in-memory only
- ✅ No hardcoded credentials - all from environment variables
- ✅ OAuth tokens encrypted at rest with AES-256-GCM

## Extension

Load the extension in Chrome:
1. Create `.env` file with required variables
2. Build: `cd packages/extension && pnpm build`
3. Open `chrome://extensions`
4. Enable Developer Mode
5. Load unpacked from `packages/extension/dist`

## Test Account

For development and testing:
- **Email**: `test@example.com`
- **Password**: `testpassword123`

## License

Private
