# PharmIntel

Pharmaceutical distribution intelligence dashboard.

## Deploy to Vercel

### Option A: CLI (fastest)

```bash
# 1. Unzip and enter directory
unzip pharmintel-vercel.zip -d pharmintel
cd pharmintel

# 2. Install Vercel CLI if you don't have it
npm i -g vercel

# 3. Deploy
vercel

# 4. Set your API key
vercel env add ANTHROPIC_API_KEY

# 5. Redeploy to pick up the env var
vercel --prod
```

### Option B: GitHub + Vercel Dashboard

1. Create a new GitHub repo and push this code
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo
4. In **Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
5. Deploy

## Local Development

```bash
npm install

# Create .env.local with your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# Start dev server (note: /api/chat won't work with plain vite)
# Use vercel dev instead:
vercel dev
```

## Architecture

- `src/App.jsx` — Full React app (single file)
- `api/chat.js` — Vercel serverless function proxying Anthropic API (keeps your key server-side)
- `vercel.json` — 60s timeout for web search calls
- Storage: localStorage (persists across sessions)
- Cache: 4-hour TTL, stale-while-revalidate
- Pre-warm: indexes all 12 topics in one API call on load
