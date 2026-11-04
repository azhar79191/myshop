export const aliases = [
  ['wheat', 'گندم', 'gandum', 'gandam'],
  ['rice', 'چاول', 'دھان', 'chawal', 'dhan'],
  ['cotton', 'کپاس', 'kapas', 'kapaas'],
  ['maize', 'corn', 'مکئی', 'makai', 'makayi'],
  ['sugarcane', 'گنا', 'ganna', 'gana'],
  ['fertilizer', 'fertilizers', 'کھاد', 'کھادیں', 'khad', 'khaad'],
  ['seed', 'seeds', 'بیج', 'beej'],
  ['urea', 'یوریا', 'yuria'],
  ['insecticide', 'insecticides', 'کیڑے مار', 'keere mar'],
  ['herbicide', 'herbicides', 'جڑی بوٹی مار', 'jari booti mar'],
  ['fungicide', 'fungicides', 'پھپھوندی کش', 'phaphundi kush'],
];
export const normalizeSearch = value => value.normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u200C\u200D]/g, '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').trim().replace(/\s+/g, ' ');
const literal = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ی/g, '[یيى]').replace(/ک/g, '[کك]');
export function productSearchPattern(value) {
  const term = normalizeSearch(value);
  const group = aliases.find(names => names.some(name => normalizeSearch(name) === term));
  const terms = [...new Set([term, ...(group || []).map(normalizeSearch)])];
  return terms.length === 1 ? literal(term) : `(?:${terms.map(literal).join('|')})`;
}
export const productSearchFields = ['name', 'description', 'category', 'brand', 'translations.ur.name', 'translations.ur.description', 'searchAliases', 'crops', 'activeIngredient', 'targetProblems'];
export function productSearchClauses(value) {
  const term = normalizeSearch(value);
  const recognizedPhrase = aliases.some(names => names.some(name => normalizeSearch(name) === term));
  const words = term.split(' ');
  const terms = recognizedPhrase || words.length > 10 ? [term] : words;
  return terms.map(word => ({ $or: productSearchFields.map(field => ({ [field]: { $regex: productSearchPattern(word), $options: 'i' } })) }));
}
