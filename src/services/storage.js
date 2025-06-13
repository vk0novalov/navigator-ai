import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

const db = new PGlite('./.pgdata/', { extensions: { vector } });
try {
  const initialSql = await readFile('./sql/schema.sql', 'utf8');
  await db.exec(initialSql);
} catch (err) {
  console.error('Error with PGLite initialization', err);
  process.exit(1);
}

export async function createWebsite(name, url) {
  const { rows } = await db.query(
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

  await db.query(
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
  await db.query(
    `INSERT INTO page_relations (website_id, from_url, to_url)
     VALUES ${values}
     ON CONFLICT (website_id, from_url, to_url) DO NOTHING`,
    [siteId, fromUrl],
  );
}

function filterByRelevance(query, docs) {
  // Simple relevance scoring based on the query and document title/content
  const words = query.split(/\s+/).filter(Boolean);
  return docs
    .map((doc) => {
      const content = `${doc.title} ${doc.content}`.toLowerCase();
      let score = words.filter((word) => content.includes(word.toLowerCase())).length;
      if (doc.title.toLowerCase().includes(query.toLowerCase())) {
        score += 5; // Boost score if title matches query
      }
      return { ...doc, score };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score);
}

export async function searchDocs(query, embedding, limit = 5) {
  const vectorLiteral = formatVector(embedding);

  const result = await db.query(
    `
  SELECT url, title, content, chunk_index, embedding <=> $1::vector AS distance
  FROM pages
  WHERE embedding <=> $1::vector < 0.7
  ORDER BY distance
  LIMIT $2
`,
    [vectorLiteral, Math.max(limit * 10, 50)], // Fetch more to filter later
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

process.on('exit', async () => {
  await db.close();
});
