import { filterByRelevance } from '../utils/docs-relevance.js';
import { RetryStrategies, retry } from '../utils/retry.js';
import db from './storage/postgresql.js';

// NOTE: only for example purposes
function namedQuery(query, params) {
  const values = [];
  const indexMap = {};
  let i = 1;

  const text = query.replace(/\$(\w+)/g, (_, key) => {
    if (!(key in params)) {
      throw new Error(`Missing param: ${key}`);
    }

    if (!(key in indexMap)) {
      indexMap[key] = i++;
      values.push(params[key]);
    }

    return `$${indexMap[key]}`;
  });

  return { text, values };
}

const runQuery = async (
  sql,
  params = {},
  { logQueryTime = false, explainAnalyze = false } = {},
) => {
  const { text, values } = namedQuery(sql, params);
  const startTime = Date.now();
  const result = await retry(
    () => db.query(explainAnalyze ? `EXPLAIN ANALYZE ${text}` : text, values),
    RetryStrategies.DATABASE,
  );
  if (logQueryTime) console.log(`ℹ️ Query took ${Date.now() - startTime}ms`);
  return result;
};

// Prepare the database for efficient vector search
// NOTE: It's OK for single-connection CLI app. For pooled apps, this SET must run on the same connection used for querying.
await runQuery('SET hnsw.ef_search = 80');

export async function createWebsite(name, url) {
  const { rows } = await runQuery(
    `INSERT INTO websites (name, url)
     VALUES ($name, $url)
     ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    { name, url },
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

export async function storePage({
  siteId,
  url,
  title,
  content,
  embedding,
  chunkIndex,
  breadcrumbs = [],
  tags = [],
}) {
  const vectorLiteral = formatVector(embedding);
  const breadcrumbsArray = `{${breadcrumbs.map((breadcrumb) => `"${breadcrumb}"`).join(',')}}`;
  const tagsArray = `{${tags.map((tag) => `"${tag}"`).join(',')}}`;

  await runQuery(
    `INSERT INTO pages (website_id, url, title, content, embedding, chunk_index, breadcrumbs, tags)
     VALUES ($siteId, $url, $title, $content, $vectorLiteral::vector, $chunkIndex, $breadcrumbsArray::text[], $tagsArray::text[])
     ON CONFLICT (website_id, url, chunk_index) DO UPDATE SET
       title = EXCLUDED.title,
       content = EXCLUDED.content,
       embedding = EXCLUDED.embedding,
       breadcrumbs = EXCLUDED.breadcrumbs,
       tags = EXCLUDED.tags`,
    { siteId, url, title, content, vectorLiteral, chunkIndex, breadcrumbsArray, tagsArray },
  );
}

export async function storePageRelations(siteId, fromUrl, urls) {
  if (!Array.isArray(urls) || urls.length === 0) return;

  const filteredUrls = urls.filter((url) => url !== fromUrl);
  if (filteredUrls.length === 0) return;

  const values = filteredUrls.map((toUrl) => `($siteId, $fromUrl, '${toUrl}')`).join(', ');
  await runQuery(
    `INSERT INTO page_relations (website_id, from_url, to_url)
     VALUES ${values}
     ON CONFLICT (website_id, from_url, to_url) DO NOTHING`,
    { siteId, fromUrl },
  );
}

export async function searchDocs(query, embedding, limit = 5) {
  const vectorLiteral = formatVector(embedding);

  const result = await runQuery(
    `
    WITH ranked AS (
      SELECT id,
            embedding <=> $vectorLiteral::vector AS vector_distance,
            similarity(title, $query) AS title_sim
      FROM pages
      WHERE embedding <=> $vectorLiteral::vector < 0.7 OR title % $query
      LIMIT $limit
    )
    SELECT url, title, content, breadcrumbs, chunk_index,
           vector_distance,
           title_sim,
           -- Hybrid score combining both signals
           CASE
             WHEN title_sim > 0.3 THEN title_sim * 2 + (1 - vector_distance) * 0.5
             ELSE (1 - vector_distance)
           END as hybrid_score
    FROM ranked JOIN pages ON ranked.id = pages.id
    ORDER BY hybrid_score DESC
`,
    { vectorLiteral, limit: Math.max(limit * 10, 50), query }, // Fetch more to filter later
    { logQueryTime: true },
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

export async function findBacklinksForRoute(toUrl) {
  const result = await runQuery(
    `
    SELECT * FROM page_relations WHERE to_url = $toUrl
  `,
    { toUrl },
  );
  return result.rows;
}

export async function dropAll() {
  await db.exec('DROP TABLE IF EXISTS websites, pages, page_relations CASCADE');
}
