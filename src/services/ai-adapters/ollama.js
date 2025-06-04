import ollama from 'ollama';

const EMBED_MODEL = 'bge-m3';
const CLASSIFIER_MODEL = 'llama3.2:3b';

// Ensure the models are pulled before using it
const requiredModels = [EMBED_MODEL, CLASSIFIER_MODEL];
const { models } = await ollama.list().catch(() => {
  console.error('❌ Ollama is not running or not accessible.');
  process.exit(1);
});
for (const model of requiredModels) {
  if (!models.some((m) => m.name.startsWith(model))) {
    console.log(`🔄 Pulling model: ${model}`);
    await ollama.pull({ model });
    console.log(`✅ Model ${model} is ready for use.`);
  }
}

export async function embed(text, { truncate = false } = {}) {
  const result = await ollama.embed({
    model: EMBED_MODEL,
    input: text,
    truncate, // we use smart chunking, so no need to truncate by default
  });
  return result.embeddings[0];
}

export async function question(text) {
  const result = await ollama.chat({
    model: CLASSIFIER_MODEL,
    messages: [{ role: 'user', content: text }],
  });
  return result.message.content;
}
