import ollama from 'ollama';

const EMBED_MODEL = 'nomic-embed-text';

// Ensure the model is pulled before using it
const { models } = await ollama.list();
if (!models.some((model) => model.name.startsWith(EMBED_MODEL))) {
  console.log(`🔄 Pulling embedding model: ${EMBED_MODEL}`);
  await ollama.pull({ model: EMBED_MODEL });
  console.log(`✅ Model ${EMBED_MODEL} is ready for use.`);
}

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return vec.map((val) => val / norm);
}

export async function embed(text) {
  const result = await ollama.embed({
    model: EMBED_MODEL,
    input: text,
    truncate: false, // we use smart chunking, so no need to truncate
  });
  return normalize(result.embeddings[0]);
}