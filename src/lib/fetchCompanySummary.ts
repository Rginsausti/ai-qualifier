export async function fetchCompanySummary(domain: string): Promise<string> {
  const base = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const variants = [
    `https://${base}/`,
    `https://www.${base}/`,
    `http://${base}/`,
    `http://www.${base}/`
  ]
  const headers = {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9,es;q=0.8'
  }
  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), 12000)
  try {
    let html = ''
    for (const url of variants) {
      try {
        const res = await fetch(url, {
          redirect: 'follow',
          cache: 'no-store',
          next: { revalidate: 0 },
          headers,
          signal: ac.signal
        })
        if (!res.ok) continue
        html = await res.text()
        if (html) break
      } catch {}
    }
    if (!html) throw new Error('unreachable')
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  } finally {
    clearTimeout(to)
  }
}
