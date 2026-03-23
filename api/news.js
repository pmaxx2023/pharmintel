// Fetches news from Google News RSS with Bing fallback - no API key needed
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { query, limit = 6 } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; PharmIntel/1.0)' };

  try {
    // Try Google News RSS first
    let xml = '';
    let source = 'google';
    try {
      const gUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const gRes = await fetch(gUrl, { headers });
      if (gRes.ok) xml = await gRes.text();
    } catch {}

    // Fallback to Bing News RSS
    if (!xml || !xml.includes('<item>')) {
      source = 'bing';
      try {
        const bUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
        const bRes = await fetch(bUrl, { headers });
        if (bRes.ok) xml = await bRes.text();
      } catch {}
    }

    if (!xml || !xml.includes('<item>')) {
      return res.status(200).json({ topline: '', items: [], debug: 'No RSS results from Google or Bing' });
    }

    // Parse RSS XML
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const block = match[1];
      const getField = (tag) => {
        const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`)) ||
                  block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].trim() : '';
      };

      const title = getField('title').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/ - [^-]+$/, ''); // strip " - Source Name" suffix
      let link = getField('link') || getField('guid');
      const pubDate = getField('pubDate');
      const srcName = getField('source') || (source === 'bing' ? 'Bing News' : 'Google News');
      
      // Google News descriptions contain HTML entities - decode them first, then strip
      let rawDesc = getField('description');
      // Decode HTML entities
      rawDesc = rawDesc.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      
      // Try to extract the real article URL from the description (Google News embeds it)
      const realUrlMatch = rawDesc.match(/href="(https?:\/\/(?!news\.google\.com)[^"]+)"/);
      if (realUrlMatch) link = realUrlMatch[1];
      
      // Now strip all HTML tags and clean up
      const desc = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

      // Format date
      let date = '';
      if (pubDate) {
        try {
          const d = new Date(pubDate);
          if (!isNaN(d.getTime())) {
            date = d.toISOString().slice(0, 10);
            // Skip if older than 90 days
            const age = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
            if (age > 90) continue;
          }
        } catch {}
      }

      if (!title) continue;

      // Guess sourceId
      const srcLower = (srcName + ' ' + title).toLowerCase();
      let sourceId = 'general';
      if (srcLower.includes('drug channel')) sourceId = 'drugchannels';
      else if (srcLower.includes('drug store news')) sourceId = 'drugstorenews';
      else if (srcLower.includes('pharmacy times')) sourceId = 'pharmacytimes';
      else if (srcLower.includes('chain drug')) sourceId = 'chaindrugreview';
      else if (srcLower.includes('rxinsider')) sourceId = 'rxinsider';
      else if (srcLower.includes('pharma commerce') || srcLower.includes('pharmaceutical commerce')) sourceId = 'pharmcommerce';

      // Guess tag
      const combined = (title + ' ' + desc).toLowerCase();
      let tag = 'MARKET';
      if (combined.match(/regulat|fda|dea|compliance|dscsa|legislation|law|rule/)) tag = 'REGULATORY';
      else if (combined.match(/cardinal|cencora|amerisource|mckesson/)) tag = 'COMPETITIVE';
      else if (combined.match(/technolog|digital|automat|ai |platform|software/)) tag = 'TECHNOLOGY';
      else if (combined.match(/revenue|earning|profit|pricing|margin|financial|quarter/)) tag = 'FINANCIAL';
      else if (combined.match(/patient|pharmacy|independent|retail|customer/)) tag = 'CUSTOMER';

      items.push({ title, source: srcName, sourceId, summary: desc || title, url: link, date, tag });
    }

    const topline = items.length > 0 ? items[0].title : '';
    return res.status(200).json({ topline, items, source });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
