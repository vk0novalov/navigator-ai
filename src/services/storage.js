import { Client } from 'pg';

const pg = new Client({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
});
await pg.connect();

export async function createWebsite(name, url) {
  const { rows } = await pg.query(
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

export async function storePage({ siteId, url, title, content, embedding, chunkIndex }) {
  const vectorLiteral = formatVector(embedding);

  await pg.query(
    `INSERT INTO pages (website_id, url, title, content, embedding, chunk_index)
     VALUES ($1, $2, $3, $4, $5::vector, $6)
     ON CONFLICT (url, chunk_index) DO UPDATE SET
       title = EXCLUDED.title,
       content = EXCLUDED.content,
       embedding = EXCLUDED.embedding`,
    [siteId, url, title, content, vectorLiteral, chunkIndex],
  );
}

export async function storePageRelations(siteId, fromUrl, urls) {
  if (!Array.isArray(urls) || urls.length === 0) return;

  const filteredUrls = urls.filter((url) => url !== fromUrl);
  if (filteredUrls.length === 0) return;

  const values = filteredUrls.map((toUrl) => `($1, $2, '${toUrl}')`).join(', ');
  await pg.query(
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
      const score = words.filter((word) =>
        `${doc.title} ${doc.content}`.toLowerCase().includes(word.toLowerCase()),
      ).length;
      return { ...doc, score };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score);
}

export async function searchDocs(query, embedding, limit = 5) {
  const vectorLiteral = formatVector(embedding);

  const result = await pg.query(
    `
  SELECT DISTINCT url, title, content, chunk_index, embedding <=> $1::vector AS distance
  FROM pages
  ORDER BY embedding <=> $1::vector ASC
  LIMIT $2
`,
    [vectorLiteral, limit * 3], // Fetch more to filter later
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

process.on('exit', async () => {
  await pg.end();
});
