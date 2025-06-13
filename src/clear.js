import { dropAll } from './services/storage.js';

await dropAll();
console.log('All data cleared successfully.');
process.exit(0);
