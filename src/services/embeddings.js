import ollama from 'ollama';

const EMBED_MODEL = 'snowflake-arctic-embed2';

// Ensure the model is pulled before using it
const { models } = await ollama.list().catch(() => {
  console.error('❌ Ollama is not running or not accessible.');
  process.exit(1);
});
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
  // NOTE: it's required for cosine similarity calculations, but it depends on the model
  return normalize(result.embeddings[0]);
}
