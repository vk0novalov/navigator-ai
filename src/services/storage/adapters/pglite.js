import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

const db = new PGlite('.pgdata/', { extensions: { vector } });
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
