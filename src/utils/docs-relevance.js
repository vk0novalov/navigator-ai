export function filterByRelevance(query, docs, { boostMax = 20, boostPerWordInTitle = 2 } = {}) {
  // Simple relevance scoring based on the query and document title/content
  const words = query
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  const queryLower = query.toLowerCase();
  return docs
    .map((doc) => {
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();

      let score = words.filter((word) => titleLower.includes(word)).length * boostPerWordInTitle;
      score += words.filter((word) => contentLower.includes(word)).length;
      if (titleLower.includes(queryLower)) {
        score += boostMax; // Boost score if title matches query
      }
      return { ...doc, score };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score);
}
