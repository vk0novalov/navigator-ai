import { embedText } from './services/embeddings.js';
import { searchDocs } from './services/storage.js';

const query = process.argv.slice(2).join(' ');
console.log(`🔦 Searching for: ${query}`);

let time = performance.now();
const embedding = await embedText(query);
console.log(`🔍 Embedding took ${(performance.now() - time).toFixed(2)}ms`);

time = performance.now();
const results = await searchDocs(query, embedding, 1);
console.log(`🔎 Search took ${(performance.now() - time).toFixed(2)}ms`);

console.log(
  results.map((doc) => ({
    title: doc.title,
    url: doc.url,
    vector_distance: doc.vector_distance,
    hybrid_score: doc.hybrid_score,
    score: doc.score,
  })),
);
process.exit(0);
