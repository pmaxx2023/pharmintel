// Fetches news from Google News RSS - free, no auth, no rate limits
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { query, limit = 6 } = req.body;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' pharmacy OR pharmaceutical OR distribution')}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url);
    const xml = await response.text();

    // Parse RSS XML
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const block = match[1];
      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/) || [])[1] || '';
      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || '';
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
      const source = (block.match(/<source[^>]*>(.*?)<\/source>/) || block.match(/<source[^>]*><!\[CDATA\[(.*?)\]\]><\/source>/) || [])[1] || '';
      const desc = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || block.match(/<description>(.*?)<\/description>/) || [])[1] || '';

      // Clean HTML from description
      const summary = desc.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim().slice(0, 300);

      // Format date
      let date = '';
      if (pubDate) {
        try {
          const d = new Date(pubDate);
          date = d.toISOString().slice(0, 10);
        } catch {}
      }

      // Skip if older than 90 days
      if (date) {
        const age = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
        if (age > 90) continue;
      }

      // Guess sourceId
      const srcLower = (source + ' ' + title).toLowerCase();
      let sourceId = 'general';
      if (srcLower.includes('drug channel')) sourceId = 'drugchannels';
      else if (srcLower.includes('drug store news')) sourceId = 'drugstorenews';
      else if (srcLower.includes('pharmacy times')) sourceId = 'pharmacytimes';
      else if (srcLower.includes('chain drug')) sourceId = 'chaindrugreview';
      else if (srcLower.includes('rxinsider')) sourceId = 'rxinsider';
      else if (srcLower.includes('pharma commerce') || srcLower.includes('pharmaceutical commerce')) sourceId = 'pharmcommerce';

      // Guess tag
      const combined = (title + ' ' + summary).toLowerCase();
      let tag = 'MARKET';
      if (combined.includes('regulation') || combined.includes('fda') || combined.includes('dea') || combined.includes('compliance') || combined.includes('dscsa')) tag = 'REGULATORY';
      else if (combined.includes('cardinal') || combined.includes('cencora') || combined.includes('amerisource') || combined.includes('mckesson')) tag = 'COMPETITIVE';
      else if (combined.includes('technology') || combined.includes('digital') || combined.includes('automation') || combined.includes('AI') || combined.includes('platform')) tag = 'TECHNOLOGY';
      else if (combined.includes('revenue') || combined.includes('earnings') || combined.includes('profit') || combined.includes('pricing') || combined.includes('margin')) tag = 'FINANCIAL';
      else if (combined.includes('patient') || combined.includes('pharmacy') || combined.includes('independent') || combined.includes('retail')) tag = 'CUSTOMER';

      items.push({
        title: title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
        source: source || 'Google News',
        sourceId,
        summary,
        url: link,
        date,
        tag,
      });
    }

    // Generate topline from first result
    const topline = items.length > 0 ? items[0].title : '';

    return res.status(200).json({ topline, items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
