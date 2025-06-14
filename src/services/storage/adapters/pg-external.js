import { Client } from 'pg';

const pg = new Client({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
});

try {
  await pg.connect();
} catch (err) {
  console.error('Error connecting to PostgreSQL database:', err);
  process.exit(1);
}

process.on('exit', async () => {
  await pg.end();
});

console.log('PostgreSQL database connection initialized successfully.');

export default pg;
