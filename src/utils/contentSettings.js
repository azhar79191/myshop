import defaults from '../config/siteContentDefaults.js';
const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
const string = (value, max) => typeof value === 'string' && value.length <= max;
const bilingual = (value, max) => object(value) && string(value.en, max) && string(value.ur, max);
const https = (value) => {
  if (!string(value, 2000)) return false;
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
};
export function validateContentSettings(settings) {
  if (settings.aboutStats !== undefined) {
    if (
      !Array.isArray(settings.aboutStats) ||
      settings.aboutStats.some(
        (row) =>
          !object(row) ||
          !string(row.number, 50) ||
          !string(row.label, 100) ||
          (row.id !== undefined &&
            (typeof row.id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(row.id))),
      )
    )
      return 'Invalid business statistics';
    const ids = settings.aboutStats.map((row) => row.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) return 'Each statistic type can only be used once';
  }
  if (settings.aboutContent !== undefined) {
    const content = settings.aboutContent;
    if (!object(content)) return 'Invalid business story';
    if (
      content.foundedYear !== undefined &&
      (!/^\d{4}$/.test(content.foundedYear) ||
        Number(content.foundedYear) < 1800 ||
        Number(content.foundedYear) > new Date().getUTCFullYear())
    )
      return 'Invalid founding year';
    for (const key of ['introduction', 'mission', 'vision', 'values', 'footerDescription'])
      if (content[key] !== undefined && !bilingual(content[key], 3000))
        return 'Business story fields require English and Urdu text';
    if (
      content.coreValues !== undefined &&
      (!Array.isArray(content.coreValues) ||
        content.coreValues.length > 12 ||
        content.coreValues.some(
          (item) =>
            !object(item) || !bilingual(item.title, 200) || !bilingual(item.description, 2000),
        ))
    )
      return 'Invalid core values';
  }
  for (const key of ['pageImages', 'pageContent', 'seoPages']) {
    if (settings[key] === undefined) continue;
    if (
      !object(settings[key]) ||
      Object.keys(settings[key]).some((name) => !Object.hasOwn(defaults[key], name))
    )
      return `Invalid ${key}`;
    for (const value of Object.values(settings[key])) {
      if (!object(value)) return `Invalid ${key}`;
      if (key === 'pageImages' && (!https(value.src) || !bilingual(value.alt, 500)))
        return 'Page images require an HTTPS URL and image descriptions';
      if (
        key === 'pageContent' &&
        (!bilingual(value.heading, 300) || !bilingual(value.intro, 3000))
      )
        return 'Invalid page content';
      if (
        key === 'seoPages' &&
        (!bilingual(value.title, 200) || !bilingual(value.description, 600) || !https(value.image))
      )
        return 'Invalid page SEO';
    }
  }
  if (settings.homepageSections !== undefined) {
    const rows = settings.homepageSections;
    if (
      !Array.isArray(rows) ||
      rows.length !== defaults.homepageSections.length ||
      new Set(rows.map((row) => row?.id)).size !== rows.length ||
      rows.some(
        (row) =>
          !defaults.homepageSections.some((item) => item.id === row?.id) ||
          typeof row.enabled !== 'boolean',
      ) ||
      rows[0]?.id !== 'hero' ||
      !rows[0]?.enabled
    )
      return 'Keep the hero first and include each homepage section once';
  }
  if (settings.policies !== undefined) {
    if (
      !object(settings.policies) ||
      Object.keys(settings.policies).some((key) => !['privacy', 'terms'].includes(key))
    )
      return 'Invalid policies';
    for (const policy of Object.values(settings.policies))
      if (
        !object(policy) ||
        !Array.isArray(policy.sections) ||
        policy.sections.length < 1 ||
        policy.sections.length > 30 ||
        policy.sections.some(
          (section) =>
            !object(section) ||
            !bilingual(section.title, 300) ||
            !bilingual(section.body, 10000) ||
            !section.title.en.trim() ||
            !section.body.en.trim(),
        )
      )
        return 'Policies require 1–30 English and Urdu sections';
  }
  if (settings.contact !== undefined) {
    if (!object(settings.contact)) return 'Invalid contact settings';
    for (const [key, max] of [
      ['latitude', 90],
      ['longitude', 180],
    ])
      if (
        settings.contact[key] !== undefined &&
        (typeof settings.contact[key] !== 'number' ||
          !Number.isFinite(settings.contact[key]) ||
          Math.abs(settings.contact[key]) > max)
      )
        return 'Invalid map coordinates';
    if (
      settings.contact.googleMapsEmbed &&
      (!https(settings.contact.googleMapsEmbed) ||
        !['www.google.com', 'maps.google.com'].includes(
          new URL(settings.contact.googleMapsEmbed).hostname,
        ))
    )
      return 'Use a Google Maps HTTPS embed URL';
  }
  return null;
}
export function stampPolicyRevisions(settings, previous, now = new Date()) {
  for (const key of ['privacy', 'terms'])
    settings.policies[key].updatedAt =
      JSON.stringify(settings.policies[key].sections) ===
      JSON.stringify(previous.policies[key].sections)
        ? previous.policies[key].updatedAt || null
        : now.toISOString();
  return settings;
}
