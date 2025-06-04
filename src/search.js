import { searchDocs } from './services/storage.js';
import { embedText } from './services/embeddings.js';

const query = process.argv.slice(2).join(' ');
console.log(`🔦 Searching for: ${query}`);

let time = Date.now();
const embedding = await embedText(query);
console.log(`🔍 Embedding took ${Date.now() - time}ms`);

time = Date.now();
const results = await searchDocs(query, embedding, 1);
console.log(`🔎 Search took ${Date.now() - time}ms`);

console.log(results.map((doc) => ({ title: doc.title, url: doc.url, distance: doc.distance })));
process.exit(0);
