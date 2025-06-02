const CHUNK_CHAR_LIMIT = 4000; // ~5000 tokens, safe size
const MIN_CHUNK_LENGTH = 500; // skip tiny chunks
const DEFAULT_OVERLAP = 200; // number of characters to overlap between chunks

export default function splitTextIntoChunks(
  text,
  { chunkSize = CHUNK_CHAR_LIMIT, skipSize = MIN_CHUNK_LENGTH, overlap = DEFAULT_OVERLAP } = {},
) {
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [text]; // basic sentence split
  const chunks = [];

  let chunk = '';
  let lastChunkEnd = ''; // Store the end of the last chunk for overlap

  for (const sentence of sentences) {
    if ((chunk + sentence).length > chunkSize) {
      if (chunk.length > skipSize) {
        chunks.push(chunk.trim());
        // Store the end of this chunk for overlap with the next one
        lastChunkEnd = chunk.slice(-overlap);
      }
      // Start new chunk with overlap from the previous one
      chunk = lastChunkEnd + sentence;
    } else {
      chunk += sentence;
    }
  }

  if (chunk.length > skipSize) {
    chunks.push(chunk.trim());
  }

  return chunks;
}
