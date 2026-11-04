export const statisticIds = ['years', 'farmers', 'products', 'brands'];
const legacyLabels = { 'Years of Service': 'years', 'Years of experience': 'years', 'Happy Farmers': 'farmers', 'Happy farmers': 'farmers', Products: 'products', 'Brand Partners': 'brands' };
export function normalizeStatistics(rows = []) {
  return rows.map((row, index) => ({ ...row, id: row.id || (Object.hasOwn(legacyLabels, row.label) ? legacyLabels[row.label] : undefined) || statisticIds[index] || `legacy-${index}` }));
}
export function statistic(settings, id) {
  return normalizeStatistics(settings.aboutStats || []).find(row => row.id === id);
}
export function normalizeBusinessSettings(settings) {
  return { ...settings, aboutStats: normalizeStatistics(settings.aboutStats || []) };
}
