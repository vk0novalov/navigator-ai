import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { vector } from '@electric-sql/pglite/vector';

const db = new PGlite('.pgdata/', { extensions: { vector, pg_trgm } });
try {
  const initialSql = await readFile('sql/schema.sql', 'utf8');
  await db.exec(initialSql);
} catch (err) {
  console.error('Error with PGLite initialization', err);
  process.exit(1);
}

process.on('exit', async () => {
  await db.close();
});

console.log('PGLite database initialized successfully.');

export default db;
