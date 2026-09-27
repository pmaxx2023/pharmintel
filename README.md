# PharmIntel

Pharmaceutical distribution intelligence dashboard.

## Deploy to Vercel

### Option A: CLI (fastest)

```bash
# 1. Clone and enter directory
git clone https://github.com/pmaxx2023/pharmintel
cd pharmintel

# 2. Install Vercel CLI if you don't have it
npm i -g vercel

# 3. Deploy
vercel

# 4. Set your API key and the passcode that unlocks the app
vercel env add ANTHROPIC_API_KEY
vercel env add APP_PASSCODE

# 5. Redeploy to pick up the env var
vercel --prod
```

### Option B: GitHub + Vercel Dashboard

1. Create a new GitHub repo and push this code
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo
4. In **Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
   - `APP_PASSCODE` = the passcode users type to unlock the app
5. Deploy

## Local Development

```bash
npm install

# Create .env.local with your API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
echo "APP_PASSCODE=choose-a-passcode" >> .env.local

# Start dev server (note: /api/chat won't work with plain vite)
# Use vercel dev instead:
vercel dev
```

## Architecture

- `src/App.jsx` — Full React app (single file)
- `api/chat.js` — Vercel serverless function proxying Anthropic API (keeps your key server-side)

## Access control

`/api/chat` refuses every request unless all of these hold:

- The request comes from the app's own domain.
- The `X-App-Passcode` header matches `APP_PASSCODE`. The app asks for the passcode once and saves it in the browser.
- The caller has made fewer than 30 requests in the past hour.

The model, output length and web search count are fixed on the server. If `APP_PASSCODE` is not set, the endpoint refuses all requests.
- `vercel.json` — 60s timeout for web search calls
- Storage: localStorage (persists across sessions)
- Cache: 4-hour TTL, stale-while-revalidate
