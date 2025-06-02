import ollama from 'ollama';

const EMBED_MODEL = 'bge-m3';
const REQUIRED_NORMALIZATION = false;

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
  if (!REQUIRED_NORMALIZATION) return vec;

  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return vec.map((val) => val / norm);
}

function clearText(text) {
  return text?.trim?.().replace(/\s+/g, ' ').replace(/\r\n/g, '\n').replace(/\n+/g, '\n');
}

function prepareTextForEmbedding(...args) {
  if (!args || !args.length) {
    throw new Error('No text provided for embedding.');
  }
  let parts = args;
  if (parts.length === 1) {
    if (Array.isArray(parts[0])) {
      parts = parts[0];
    } else {
      return parts[0].trim?.() || '';
    }
  }
  return parts.map(clearText).filter(Boolean).join('\n\n');
}

export async function embed(text) {
  const result = await ollama.embed({
    model: EMBED_MODEL,
    input: prepareTextForEmbedding(text),
    truncate: false, // we use smart chunking, so no need to truncate
  });
  // NOTE: it's required for cosine similarity calculations, but it depends on the model
  return normalize(result.embeddings[0]);
}
