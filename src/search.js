import { searchDocs } from './services/storage.js';
import { embed } from './services/embeddings.js';

const query = process.argv.slice(2).join(' ');
console.log(`🔦 Searching for: ${query}`);

const embedding = await embed(query);
const results = await searchDocs(embedding, 1);

console.log(results.map((doc) => ({ title: doc.title, distance: doc.distance })));
process.exit(0);
