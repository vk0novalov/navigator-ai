CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  content TEXT,
  embedding VECTOR(768) -- match your embedding size
);

CREATE TABLE page_relations (
  from_page_id INT REFERENCES pages(id),
  to_page_id INT REFERENCES pages(id),
  relation_type TEXT,
  PRIMARY KEY (from_page_id, to_page_id)
);
