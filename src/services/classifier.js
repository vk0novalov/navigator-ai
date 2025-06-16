import { question } from './ai-adapters/ollama.js';

export async function classifyText(text, labels) {
  const prompt = `
You are a zero-shot text classifier.

Evaluate how strongly the following message relates to each of the following labels: [${labels}].

Assign a score between 0 and 1 for each label. Return JSON like:
[
  { "label": "label1", "score": 0.91 },
  ...
]
Only return well structured JSON without extra formatting. Do not wrap to Markdown. Do not explain.

Message:
${text}`;
  const json = await question(prompt);
  try {
    const parsed = JSON.parse(json);
    // Remove duplicates based on label, cuz some models might return the same label multiple times
    const seen = new Set();
    const filtered = parsed.filter((item) => {
      if (seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    });
    return filtered.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error('❌ Error processing JSON:', {
      json,
      error,
    });
    return [];
  }
}

export async function generateTags(text) {
  const prompt = `You are a tagging assistant for a blog. Given a blog post, return from 3 up to 5 extremely relevant lowercase tags that summarize its key themes.

Rules:
- Only return JSON array of strings. Do not explain. Avoid any formatting, avoid markdown.
- Tags must be lowercase, 1–3 simple words.
- Do not use hashtags or acronyms unless extremely common (e.g. "api", "html", "css").
- Avoid jargon, invented phrases, or abstract concepts.
- Use only topics clearly mentioned in the text.
- Try to detect maximum relevant technologies, frameworks, libraries, and tools mentioned in the text.`;
  const result = await question(`${prompt}\n\nBlog content:\n"""${text}\n"""`);
  try {
    const tags = JSON.parse(result);
    if (Array.isArray(tags) && tags.length > 0) {
      return tags.map((tag) => tag.toLowerCase().trim()).filter(Boolean);
    }
    return [];
  } catch (error) {
    console.error('❌ Error processing JSON:', {
      json: result,
      error,
    });
    return [];
  }
}
