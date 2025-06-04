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
${text}
`;
  const result = await question(prompt);
  const json = result.startsWith('```')
    ? (result.match(/```json\s*([\s\S]*?)\s*```/)?.[1] ?? result)
    : result;
  const parsed = JSON.parse(json);
  // Remove duplicates based on label, cuz some models might return the same label multiple times
  const seen = new Set();
  const filtered = parsed.filter((item) => {
    if (seen.has(item.label)) return false;
    seen.add(item.label);
    return true;
  });
  return filtered.sort((a, b) => b.score - a.score);
}
