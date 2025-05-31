import { Client } from 'pg';

const pg = new Client({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
});
await pg.connect();

// Format the embedding array as a PostgreSQL vector literal
const formatVector = (vector) => {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('Invalid vector format. Must be a non-empty array.');
  }
  return `[${vector.join(',')}]`;
};

export async function storePage(url, title, content, embedding, index) {
  const vectorLiteral = formatVector(embedding);

  await pg.query(
    `INSERT INTO pages (url, title, content, embedding, chunk_index)
     VALUES ($1, $2, $3, $4::vector, $5)
     ON CONFLICT (url, chunk_index) DO UPDATE SET
       title = EXCLUDED.title,
       content = EXCLUDED.content,
       embedding = EXCLUDED.embedding`,
    [url, title, content, vectorLiteral, index],
  );
}

export async function searchDocs(embedding, limit = 5) {
  const vectorLiteral = formatVector(embedding);

  const result = await pg.query(
    `
  SELECT url, title, content, chunk_index, embedding <-> $1::vector AS distance
  FROM pages
  ORDER BY embedding <-> $1::vector ASC
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
  return Array.from(uniqueRows.values().take(limit));
}

process.on('exit', async () => {
  await pg.end();
});
