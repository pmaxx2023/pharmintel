import { timingSafeEqual } from 'node:crypto';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4000;
const MAX_INPUT_CHARS = 8000;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const hits = new Map();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket?.remoteAddress || 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function passcodeOk(req) {
  const expected = process.env.APP_PASSCODE;
  if (!expected) return false;
  const given = req.headers['x-app-passcode'];
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!sameOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!passcodeOk(req)) {
    return res.status(401).json({ error: 'Passcode required' });
  }

  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ error: 'Too many requests. Try again later.', status: 429 });
  }

  const { system, message } = req.body || {};
  if (typeof system !== 'string' || typeof message !== 'string' || !system || !message) {
    return res.status(400).json({ error: 'Missing system or message' });
  }
  if (system.length + message.length > MAX_INPUT_CHARS) {
    return res.status(413).json({ error: 'Request too large' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.error?.message || 'API error',
        status: response.status 
      });
    }

    // Extract text content
    let text = '';
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') text += block.text;
      }
    }

    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
