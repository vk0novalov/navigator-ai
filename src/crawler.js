import { generateTags } from './services/classifier.js';
import { embedText } from './services/embeddings.js';
import { normalizeUrl, parseFromHTML } from './services/html-parser.js';
import { createWebsite, storePage, storePageRelations } from './services/storage.js';
import { spawnWorkers } from './utils/promise-limit.js';
import { RetryStrategies, retry } from './utils/retry.js';
import splitTextIntoChunks from './utils/split-text-into-chunks.js';

const BASE_URL = process.env.TARGET_SITE || 'https://overreacted.io';

const MAX_DEPTH = process.env.MAX_DEPTH || 3;
const MAX_CONCURRENT = process.env.MAX_CONCURRENT || 1;

const urlsQueue = [];

async function crawl({ siteId, url, visited, depth, breadcrumbs = [] }) {
  if (visited.has(url) || depth > MAX_DEPTH) return;
  visited.add(url);

  const currentBreadcrumbs = [...breadcrumbs, new URL(url).pathname];

  console.log(`🔍 Crawling: ${url}`);
  try {
    const html = await retry(() => fetch(url).then((res) => res.text()), RetryStrategies.NETWORK);
    const page = await parseFromHTML(html, BASE_URL);
    if (!page) return;

    const shortSummary = [page.title, page.content.slice(0, 5000)].join('\n\n');
    const semanticTags = await generateTags(shortSummary);
    console.log('Generated tags:', semanticTags);

    const chunks = splitTextIntoChunks(page.content);
    for (const [i, chunk] of chunks.entries()) {
      const content = i === 0 ? `Title: ${page.title}\n\nContent: ${chunk}` : chunk;
      const embedding = await embedText(content);
      await storePage({
        siteId,
        url,
        title: page.title,
        content: page.content,
        embedding,
        chunkIndex: i,
        breadcrumbs: currentBreadcrumbs,
        tags: semanticTags,
      });
    }

    if (!page.urls) return;

    await storePageRelations(siteId, url, page.urls);

    if (depth < MAX_DEPTH) {
      urlsQueue.push(
        ...page.urls.map((url) => ({
          siteId,
          url,
          depth: depth + 1,
          visited,
          breadcrumbs: currentBreadcrumbs,
        })),
      );
    }
  } catch (err) {
    console.error(`❌ Failed to crawl ${url}:`, err.message);
  }
}

async function main() {
  const normalizedUrl = normalizeUrl('/', BASE_URL);
  const site = await createWebsite('Overreacted', normalizedUrl);

  console.log(`Starting crawl from ${normalizedUrl}`);
  urlsQueue.push({ siteId: site.id, url: normalizedUrl, depth: 0, visited: new Set() });

  await spawnWorkers(urlsQueue, crawl, MAX_CONCURRENT);

  console.log('✅ Done crawling');
  process.exit(0);
}
main().catch((err) => {
  console.error('❌ Error in main:', err);
  process.exit(1);
});
