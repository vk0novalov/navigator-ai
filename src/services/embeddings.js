import { embed } from './ai-adapters/ollama.js';

const REQUIRED_NORMALIZATION = false;

function normalize(vec) {
  if (!REQUIRED_NORMALIZATION) return vec;

  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return vec.map((val) => val / norm);
}

function clearText(text) {
  return text
    ?.trim?.()
    .replace(/\s+/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/\n(?=\w)/g, ' ')
    .replace(/\n+/g, '\n');
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

export async function classifyViaEmbeddings(text, labels) {
  const hypotheses = labels.map((label) => `This text is about ${label}.`);
  const allTexts = [text, ...hypotheses];

  const embeddings = await Promise.all(allTexts.map((text) => embed(text, { truncate: true })));

  const [textVector, ...labelVectors] = embeddings;

  const cosine = (a, b) =>
    a.reduce((sum, val, i) => sum + val * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b));

  return labels
    .map((label, i) => ({
      label,
      score: cosine(textVector, labelVectors[i]),
    }))
    .sort((a, b) => b.score - a.score);
}

export async function embedText(text) {
  const embeddings = await embed(prepareTextForEmbedding(text));
  // NOTE: it's required for cosine similarity calculations, but it depends on the model
  return normalize(embeddings);
}
