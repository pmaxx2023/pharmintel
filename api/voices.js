// Fetches quotes/statements by industry voices via news RSS
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { name, title, topic } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; PharmIntel/1.0)' };
  const topicStr = topic ? ` ${topic}` : ' pharmacy pharmaceutical distribution';
  const query = `"${name}"${topicStr}`;

  try {
    let xml = '';

    // Try Google News RSS
    try {
      const gUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const gRes = await fetch(gUrl, { headers });
      if (gRes.ok) xml = await gRes.text();
    } catch {}

    // Fallback to Bing News RSS
    if (!xml || !xml.includes('<item>')) {
      try {
        const bUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss`;
        const bRes = await fetch(bUrl, { headers });
        if (bRes.ok) xml = await bRes.text();
      } catch {}
    }

    if (!xml || !xml.includes('<item>')) {
      return res.status(200).json({ stmts: [] });
    }

    const stmts = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && stmts.length < 3) {
      const block = match[1];
      const getField = (tag) => {
        const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`)) ||
                  block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].trim() : '';
      };

      const itemTitle = getField('title').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/ - [^-]+$/, '');
      let link = getField('link') || getField('guid');
      const pubDate = getField('pubDate');
      const source = getField('source') || 'News';
      let rawDesc = getField('description');
      rawDesc = rawDesc.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
      const realUrlMatch = rawDesc.match(/href="(https?:\/\/(?!news\.google\.com)[^"]+)"/);
      if (realUrlMatch) link = realUrlMatch[1];
      const desc = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      let date = '';
      if (pubDate) {
        try {
          const d = new Date(pubDate);
          if (!isNaN(d.getTime())) {
            date = d.toISOString().slice(0, 10);
            const age = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
            if (age > 90) continue;
          }
        } catch {}
      }

      if (!itemTitle && !desc) continue;

      stmts.push({
        quote: desc.slice(0, 250) || itemTitle,
        context: `${source}${date ? `, ${date}` : ''}`,
        url: link,
        date,
      });
    }

    return res.status(200).json({ stmts });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
