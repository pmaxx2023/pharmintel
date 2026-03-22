// Fetches quotes/statements by industry voices via Google News RSS
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { name, title, topic } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  try {
    // Search for the person's name + optional topic in news
    const topicStr = topic ? ` ${topic}` : ' pharmacy pharmaceutical distribution';
    const query = `"${name}"${topicStr} said OR stated OR announced OR commented`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url);
    const xml = await response.text();

    const stmts = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && stmts.length < 3) {
      const block = match[1];
      const itemTitle = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/) || [])[1] || '';
      const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || '';
      const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
      const source = (block.match(/<source[^>]*>(.*?)<\/source>/) || block.match(/<source[^>]*><!\[CDATA\[(.*?)\]\]><\/source>/) || [])[1] || '';
      const desc = (block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || block.match(/<description>(.*?)<\/description>/) || [])[1] || '';
      const cleanDesc = desc.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();

      let date = '';
      if (pubDate) {
        try {
          const d = new Date(pubDate);
          date = d.toISOString().slice(0, 10);
          // Skip if older than 90 days
          const age = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
          if (age > 90) continue;
        } catch {}
      }

      // Use the article title/description as the "quote" context
      // Real quotes would require fetching the full article
      stmts.push({
        quote: cleanDesc.slice(0, 250) || itemTitle,
        context: `${source || 'News'}${date ? `, ${date}` : ''}`,
        url: link,
        date,
      });
    }

    return res.status(200).json({ stmts });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
