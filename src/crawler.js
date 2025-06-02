import { processAsync } from './utils/promise-limit.js';
import { embed } from './services/embeddings.js';
import { normalizeUrl, parseFromHTML } from './services/html-parser.js';
import { createWebsite, storePage, storePageRelations } from './services/storage.js';
import splitTextIntoChunks from './utils/split-text-into-chunks.js';

const BASE_URL = 'https://overreacted.io';

const MAX_DEPTH = 3;
const MAX_CONCURRENT = 1;

const visited = new Set();

async function crawl(siteId, url, depth = 0) {
  if (visited.has(url) || depth > MAX_DEPTH) return;
  visited.add(url);

  console.log(`🔍 Crawling: ${url}`);
  try {
    const html = await fetch(url).then((res) => res.text());
    const page = await parseFromHTML(html, BASE_URL);
    if (!page) return;

    const chunks = splitTextIntoChunks(page.content);
    for (const [i, chunk] of chunks.entries()) {
      const embedding = await embed(`Title: ${page.title}`, `Content: ${chunk}`);
      await storePage({
        siteId,
        url,
        title: page.title,
        content: page.content,
        embedding,
        chunkIndex: i,
      });
    }

    if (!page.urls) return;

    await storePageRelations(siteId, url, page.urls);

    await processAsync(
      page.urls,
      async (url) => await crawl(siteId, url, depth + 1),
      MAX_CONCURRENT,
    );
  } catch (err) {
    console.error(`❌ Failed to crawl ${url}:`, err.message);
  }
}

async function main() {
  const normalizedUrl = normalizeUrl('/', BASE_URL);
  const site = await createWebsite('Overreacted', normalizedUrl);

  console.log(`Starting crawl from ${normalizedUrl}`);
  await crawl(site.id, normalizeUrl('/', normalizedUrl));
  console.log('✅ Done crawling');
  process.exit(0);
}
main().catch((err) => {
  console.error('❌ Error in main:', err);
  process.exit(1);
});
