# Navigator AI

Navigator AI is a project that uses PostgreSQL with the pgvector extension to store and search web page data and their relationships using vector embeddings.

## Features
- Stores web pages with content and vector embeddings
- Tracks relationships between pages
- Uses pgvector for efficient vector search

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Ollama
- Node.js (for running scripts in `src/`)

### Setup
1. Clone the repository.
2. Copy `.env.example` to `.env` and set your environment variables.

### Usage
- Add or crawl pages using scripts in `src/`.
```sh
npm run crawler
```
- Query and search using vector embeddings.
```sh
npm run search "two computers"
```

## Database
- Uses PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension.
- Schema is defined in `sql/schema.sql`.
