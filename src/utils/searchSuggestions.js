import { normalizeSearch, aliases } from './productSearch.js';
// Suggestions never silently replace a customer's query. Candidate work is bounded.
function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  let previous;
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (previous && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) next[j] = Math.min(next[j], previous[j - 2] + 1);
    }
    previous = row;
    row = next;
  }
  return row[b.length];
}
export function searchSuggestions(query, products) {
  const words = normalizeSearch(query).split(' ').slice(0, 10);
  const candidates = new Set();
  for (const product of products.slice(0, 300)) {
    const fields = [product.name, product.translations?.ur?.name, product.brand, product.category, product.activeIngredient, ...(product.crops || []), ...(product.searchAliases || [])];
    for (const field of fields) if (typeof field === 'string') for (const word of normalizeSearch(field).split(/[\s,;/]+/)) {
      if (word.length >= 3 && word.length <= 40 && candidates.size < 1500) candidates.add(word);
    }
  }
  for (const group of aliases) if (group.some(name => candidates.has(normalizeSearch(name)))) for (const name of group) candidates.add(normalizeSearch(name));
  const suggestions = [];
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    if (word.length < 3 || word.length > 40 || candidates.has(word) || /\d/.test(word)) continue;
    for (const candidate of candidates) {
      if (Math.abs(word.length - candidate.length) > 2) continue;
      const score = distance(word, candidate);
      if (score > 0 && score <= (word.length > 5 ? 2 : 1)) suggestions.push({ text: words.map((value, i) => i === index ? candidate : value).join(' '), score });
    }
  }
  return [...new Set(suggestions.sort((a, b) => a.score - b.score || a.text.localeCompare(b.text)).map(item => item.text))].slice(0, 4);
}
