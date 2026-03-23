// Fetches a URL and extracts article text - follows Google News redirects
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
  };

  try {
    // If it's a Google News redirect, follow it to get the real URL
    if (url.includes('news.google.com')) {
      try {
        const redirectRes = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(5000) });
        const location = redirectRes.headers.get('location');
        if (location && !location.includes('news.google.com')) {
          url = location;
        } else {
          // Google sometimes embeds the real URL in the page
          const body = await (await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(5000) })).text();
          const realMatch = body.match(/data-redirect="(https?:\/\/[^"]+)"/) ||
                            body.match(/href="(https?:\/\/(?!news\.google|accounts\.google|support\.google)[^"]+)".*?target/);
          if (realMatch) url = realMatch[1];
        }
      } catch {}
    }

    // Now fetch the actual article
    const response = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (!response.ok) return res.status(200).json({ text: '', url });

    const html = await response.text();

    // Extract text using multiple strategies
    let paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = pRegex.exec(html)) !== null) {
      let clean = m[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
        .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
        .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
        .replace(/&#\d+;/g, ' ')
        .replace(/\s+/g, ' ').trim();
      // Skip junk: too short, boilerplate, navigation
      if (clean.length > 50 &&
          !clean.match(/cookie|subscribe|newsletter|sign up|log in|privacy|copyright|terms of|all rights|advertisement/i) &&
          !clean.match(/^(Share|Tweet|Email|Print|Comment|Related|Read more|Click here)/i)) {
        paragraphs.push(clean);
      }
    }

    // If no good paragraphs, try meta description
    if (paragraphs.length === 0) {
      const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      if (metaMatch) paragraphs.push(metaMatch[1]);
    }

    // Take first 3 paragraphs, join to ~500 chars
    const text = paragraphs.slice(0, 3).join(' ').slice(0, 500);

    return res.status(200).json({ text, url });
  } catch (error) {
    return res.status(200).json({ text: '', url });
  }
}
