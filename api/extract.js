// Fetches a URL and extracts article text - for enriching RSS results
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return res.status(200).json({ text: '' });

    const html = await response.text();

    // Extract article text using multiple strategies
    let text = '';

    // Strategy 1: Look for common article content selectors via regex
    // Try <article> tag first
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      text = articleMatch[1];
    }
    
    // Strategy 2: Look for paragraphs inside common content divs
    if (!text || text.length < 100) {
      const bodyMatch = html.match(/<(?:div|section)[^>]*(?:class|id)="[^"]*(?:article|content|story|post|entry|body|text)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/i);
      if (bodyMatch) text = bodyMatch[1];
    }

    // Strategy 3: Grab all <p> tags
    if (!text || text.length < 100) {
      const paragraphs = [];
      const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let m;
      while ((m = pRegex.exec(html)) !== null) {
        const clean = m[1].replace(/<[^>]*>/g, '').trim();
        // Skip very short paragraphs (nav items, buttons) and boilerplate
        if (clean.length > 40 && !clean.match(/cookie|subscribe|newsletter|sign up|log in|privacy|copyright/i)) {
          paragraphs.push(clean);
        }
      }
      text = paragraphs.join(' ');
    }

    // Strategy 4: meta description as last resort
    if (!text || text.length < 50) {
      const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      if (metaMatch) text = metaMatch[1];
    }

    // Clean up
    text = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
      .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
      .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500); // First 500 chars is plenty for a summary

    return res.status(200).json({ text });
  } catch (error) {
    // Timeout or network error - return empty, don't fail
    return res.status(200).json({ text: '' });
  }
}
