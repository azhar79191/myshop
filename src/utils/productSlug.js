export const productSlug = (name, id) => {
  const title = String(name)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
    .replace(/-$/, '');
  return `${title || 'product'}-${id}`;
};
