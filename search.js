import { Client } from 'pg';

const pg = new Client({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
});
await pg.connect();

const query = process.argv.slice(2).join(' ');
console.log(`🔦 Searching for: ${query}`);

const res = await fetch('http://localhost:11434/api/embeddings', {
  method: 'POST',
  body: JSON.stringify({ model: 'nomic-embed-text', prompt: query }),
  headers: { 'Content-Type': 'application/json' },
});
const { embedding } = await res.json();

// Format the embedding array as a PostgreSQL vector literal
const vectorLiteral = `[${embedding.join(',')}]`;

const result = await pg.query(
  `
  SELECT url, title, content, embedding <-> $1::vector AS distance
  FROM pages
  ORDER BY embedding <-> $1::vector ASC
  LIMIT 5
`,
  [vectorLiteral],
);

console.log(result.rows);
pg.end();
