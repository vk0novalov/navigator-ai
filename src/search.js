import { embedText } from './services/embeddings.js';
import { findBacklinksForRoute, searchDocs } from './services/storage.js';

const query = process.argv.slice(2).join(' ');
console.log(`🔦 Searching for: ${query}`);

let time = performance.now();
const embedding = await embedText(query);
console.log(`🔍 Embedding took ${(performance.now() - time).toFixed(2)}ms`);

time = performance.now();
const results = await searchDocs(query, embedding, 1);
console.log(`🔎 Search took ${(performance.now() - time).toFixed(2)}ms`);

if (results.length === 0) {
  console.log('❎ No results found.');
  process.exit(0);
}

console.log(
  results.map((doc) => ({
    title: doc.title,
    url: doc.url,
    breadcrumbs: doc.breadcrumbs,
    vector_distance: doc.vector_distance,
    hybrid_score: doc.hybrid_score,
    score: doc.score,
  })),
);

time = performance.now();
const [doc] = results;
const routes = await findBacklinksForRoute(doc.url);
console.log(`🔗 Search for backlinks took ${(performance.now() - time).toFixed(2)}ms`);

if (routes.length > 1) {
  console.log(
    `🌐 This page is reachable from the following ${routes.length} route${routes.length > 1 ? 's' : ''}:`,
  );
  console.log(routes.map((r) => r.from_url).join('; '));
} else {
  console.log('❎ This page is reachable only by one route.');
}

process.exit(0);
