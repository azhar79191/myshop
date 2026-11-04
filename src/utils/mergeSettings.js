export function mergeSettings(...sources) {
  const result = {};
  for (const source of sources)
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      for (const [key, value] of Object.entries(source)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
        result[key] = Array.isArray(value)
          ? structuredClone(value)
          : value && typeof value === 'object'
            ? mergeSettings(result[key], value)
            : value;
      }
    }
  return result;
}
