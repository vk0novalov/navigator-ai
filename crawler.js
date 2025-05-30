import * as cheerio from 'cheerio';
import { Client } from 'pg';
import { mapAsync } from './lib/promise-limit.js';

const BASE_URL = 'https://overreacted.io';
const MAX_DEPTH = 2;
const visited = new Set();
const MAX_CONCURRENT = 5;

const pg = new Client({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
});
await pg.connect();

async function embed(text) {
  const res = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  return data.embedding;
}

async function storePage(url, title, content, embedding) {
  // Format the embedding array as a PostgreSQL vector literal
  const vectorLiteral = `[${embedding.join(',')}]`;

  await pg.query(
    `INSERT INTO pages (url, title, content, embedding)
     VALUES ($1, $2, $3, $4::vector)
     ON CONFLICT (url) DO NOTHING`,
    [url, title, content, vectorLiteral],
  );
}

async function crawl(url, depth = 0) {
  if (visited.has(url) || depth > MAX_DEPTH) return;
  visited.add(url);

  console.log(`🔍 Crawling: ${url}`);
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('title').text();
    const content = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000);
    const embedding = await embed(content);

    await storePage(url, title, content, embedding);

    const links = $('a[href]')
      .map((i, el) => $(el).attr('href'))
      .get();

    await mapAsync(
      links,
      async (link) => {
        if (link.startsWith('/') || link.startsWith(BASE_URL)) {
          const fullUrl = link.startsWith('http') ? link : `${BASE_URL}${link}`;
          await crawl(fullUrl, depth + 1);
        }
      },
      MAX_CONCURRENT,
    );
  } catch (err) {
    console.error(`❌ Failed to crawl ${url}:`, err.message);
  }
}

crawl(BASE_URL).then(() => {
  console.log('✅ Done crawling');
  pg.end();
});
