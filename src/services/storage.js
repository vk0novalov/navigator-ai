import { filterByRelevance } from '../utils/docs-relevance.js';
import { RetryStrategies, retry } from '../utils/retry.js';
import db from './storage/postgresql.js';

const runQuery = (sql, params = []) => retry(() => db.query(sql, params), RetryStrategies.DATABASE);

// Prepare the database for efficient vector search
// NOTE: It's OK for single-connection CLI app. For pooled apps, this SET must run on the same connection used for querying.
await runQuery('SET hnsw.ef_search = 50');

export async function createWebsite(name, url) {
  const { rows } = await runQuery(
    `INSERT INTO websites (name, url)
     VALUES ($1, $2)
     ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, url],
  );
  return rows[0];
}

// Format the embedding array as a PostgreSQL vector literal
const formatVector = (vector) => {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('Invalid vector format. Must be a non-empty array.');
  }
  return `[${vector.join(',')}]`;
};

export async function storePage({ siteId, url, title, content, embedding, chunkIndex, tags = [] }) {
  const vectorLiteral = formatVector(embedding);
  const tagsArray = `{${tags.map((tag) => `"${tag}"`).join(',')}}`;

  await runQuery(
    `INSERT INTO pages (website_id, url, title, content, embedding, chunk_index, tags)
     VALUES ($1, $2, $3, $4, $5::vector, $6, $7::text[])
     ON CONFLICT (url, chunk_index) DO UPDATE SET
       title = EXCLUDED.title,
       content = EXCLUDED.content,
       embedding = EXCLUDED.embedding,
       tags = EXCLUDED.tags`,
    [siteId, url, title, content, vectorLiteral, chunkIndex, tagsArray],
  );
}

export async function storePageRelations(siteId, fromUrl, urls) {
  if (!Array.isArray(urls) || urls.length === 0) return;

  const filteredUrls = urls.filter((url) => url !== fromUrl);
  if (filteredUrls.length === 0) return;

  const values = filteredUrls.map((toUrl) => `($1, $2, '${toUrl}')`).join(', ');
  await runQuery(
    `INSERT INTO page_relations (website_id, from_url, to_url)
     VALUES ${values}
     ON CONFLICT (website_id, from_url, to_url) DO NOTHING`,
    [siteId, fromUrl],
  );
}

export async function searchDocs(query, embedding, limit = 5) {
  const vectorLiteral = formatVector(embedding);

  const result = await runQuery(
    `
    SELECT url, title, content, chunk_index,
           vector_distance,
           title_sim,
           -- Hybrid score combining both signals
           CASE
             WHEN title_sim > 0.3 THEN title_sim * 2 + (1 - vector_distance) * 0.5
             ELSE (1 - vector_distance)
           END as hybrid_score
    FROM (
      SELECT url, title, content, chunk_index,
             embedding <=> $1::vector AS vector_distance,
             similarity(title, $3) AS title_sim
      FROM pages
      WHERE embedding <=> $1::vector < 0.7 OR title % $3
    ) ranked
    ORDER BY hybrid_score DESC
    LIMIT $2
`,
    [vectorLiteral, Math.max(limit * 10, 50), query], // Fetch more to filter later
  );

  const { rows } = result;
  if (rows.length === 0) return [];

  // Filtering out duplicates here is more efficient than using DISTINCT in SQL and provides more control for post-processing
  const uniqueRows = new Map();
  for (const row of rows) {
    if (!uniqueRows.has(row.url)) {
      // NOTE: Maybe we will want to keep another chunks of the same URL later
      uniqueRows.set(row.url, row);
    }
  }

  // extra step to filter by relevance, because we might have fetched more rows than needed
  return filterByRelevance(query, Array.from(uniqueRows.values())).slice(0, limit);
}

export async function dropAll() {
  await db.exec('DROP TABLE IF EXISTS websites, pages, page_relations CASCADE');
}
