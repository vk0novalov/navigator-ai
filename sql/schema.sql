CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  embedding VECTOR(768),
  chunk_index INT DEFAULT 0,
  UNIQUE (url, chunk_index)
);

CREATE TABLE IF NOT EXISTS page_relations (
  from_page_id INT REFERENCES pages(id),
  to_page_id INT REFERENCES pages(id),
  relation_type TEXT,
  PRIMARY KEY (from_page_id, to_page_id)
);
