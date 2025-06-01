const CHUNK_CHAR_LIMIT = 5000; // ~5000 tokens, safe size
const MIN_CHUNK_LENGTH = 500; // skip tiny chunks

export default function splitTextIntoChunks(
  text,
  { chunkSize, skipSize } = { chunkSize: CHUNK_CHAR_LIMIT, skipSize: MIN_CHUNK_LENGTH },
) {
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text]; // basic sentence split
  const chunks = [];

  let chunk = '';
  for (const sentence of sentences) {
    if ((chunk + sentence).length > chunkSize) {
      if (chunk.length > skipSize) chunks.push(chunk.trim());
      chunk = sentence;
    } else {
      chunk += sentence;
    }
  }
  if (chunk.length > skipSize) chunks.push(chunk.trim());

  return chunks;
}
