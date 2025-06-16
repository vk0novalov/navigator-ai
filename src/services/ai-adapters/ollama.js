import ollama, { Ollama } from 'ollama';
import { cleanupResponse } from './ai-utils';

const EMBED_MODEL = 'bge-m3';
const CLASSIFIER_MODEL = 'qwen3:30b-a3b';

const { OLLAMA_URL } = process.env;

const ollamaClient = OLLAMA_URL ? new Ollama({ host: OLLAMA_URL }) : ollama;
export default ollamaClient;

// Useful for simultaneous requests
export function createOllamaClient() {
  return OLLAMA_URL ? new Ollama({ host: OLLAMA_URL }) : new Ollama();
}

// Ensure the models are pulled before using it
const requiredModels = [EMBED_MODEL, CLASSIFIER_MODEL];
const { models } = await ollamaClient.list().catch(() => {
  console.error('❌ Ollama is not running or not accessible.');
  process.exit(1);
});
for (const model of requiredModels) {
  if (!models.some((m) => m.name.startsWith(model))) {
    console.log(`🔄 Pulling model: ${model}`);
    await ollamaClient.pull({ model });
    console.log(`✅ Model ${model} is ready for use.`);
  }
}

export async function embed(text, { truncate = false } = {}) {
  const result = await ollamaClient.embed({
    model: EMBED_MODEL,
    input: text,
    truncate, // we use smart chunking, so no need to truncate by default
  });
  return result.embeddings[0];
}

export async function question(text) {
  const result = await ollamaClient.chat({
    model: CLASSIFIER_MODEL,
    messages: [{ role: 'user', content: `${text} /no_think` }],
  });
  return cleanupResponse(result.message.content);
}
