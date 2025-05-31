import { processAsync } from './utils/promise-limit.js';
import { embed } from './services/embeddings.js';
import { parseFromHTML } from './services/html-parser.js';
import { storePage } from './services/storage.js';
import splitTextIntoChunks from './utils/split-text-into-chunks.js';

const BASE_URL = 'https://overreacted.io/';

const MAX_DEPTH = 3;
const MAX_CONCURRENT = 1;

const visited = new Set();

async function crawl(url, depth = 0) {
  if (visited.has(url) || depth > MAX_DEPTH) return;
  visited.add(url);

  console.log(`🔍 Crawling: ${url}`);
  try {
    const html = await fetch(url).then((res) => res.text());
    const page = await parseFromHTML(html, BASE_URL);

    const chunks = splitTextIntoChunks(page.content);
    for (const [i, chunk] of chunks.entries()) {
      const embedding = await embed(chunk);
      await storePage(url, page.title, page.content, embedding, i);
    }

    await processAsync(
      page.urls,
      async (url) => {
        await crawl(url, depth + 1);
      },
      MAX_CONCURRENT,
    );
  } catch (err) {
    console.error(`❌ Failed to crawl ${url}:`, err.message);
  }
}

crawl(BASE_URL).then(() => {
  console.log('✅ Done crawling');
  process.exit(0);
});
