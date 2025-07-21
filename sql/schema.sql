CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS websites (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  name TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  website_id INT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1024) NOT NULL,  -- Adjust dimension as needed
  tags TEXT[] NOT NULL DEFAULT '{}',
  chunk_index INT NOT NULL DEFAULT 0,
  UNIQUE (url, chunk_index)
);

CREATE INDEX IF NOT EXISTS pages_title_trgm_idx ON pages USING GIN (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS page_relations (
  id SERIAL PRIMARY KEY,
  website_id INT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  from_url TEXT NOT NULL,
  to_url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'link',
  score REAL,  -- optional, for embedding similarity or link strength
  context_snippet TEXT,  -- optional, for anchor text or link summary
  UNIQUE (website_id, from_url, to_url)
);

CREATE INDEX IF NOT EXISTS pages_embedding_index ON pages USING hnsw (embedding vector_cosine_ops);
