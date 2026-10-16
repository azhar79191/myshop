const NO_STORE_PREFIXES = ['/api/auth', '/api/contact', '/api/service-requests'];

export const getCacheControl = (path, method = 'GET', hasAuthorization = false) => {
  if (method !== 'GET' || hasAuthorization || path === '/api/health') {
    return 'no-store';
  }

  if (
    NO_STORE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ||
    path === '/api/site-settings' ||
    path.startsWith('/api/site-settings/')
  ) {
    return 'no-store';
  }

  if (
    path.includes('/categories') ||
    path.endsWith('/brands/all') ||
    path === '/api/brands'
  ) {
    return 'public, max-age=300, s-maxage=900, stale-while-revalidate=1800';
  }

  if (path.startsWith('/api/products')) {
    return 'public, max-age=300, s-maxage=900, stale-while-revalidate=1800';
  }

  if (path.startsWith('/api/gallery') || path.startsWith('/api/faqs')) {
    return 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600';
  }

  if (path.startsWith('/api/testimonials/approved')) {
    return 'public, max-age=900, s-maxage=3600, stale-while-revalidate=7200';
  }

  if (path.startsWith('/api/brands')) {
    return 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600';
  }

  return 'no-store';
};

export const cachePolicyMiddleware = (req, res, next) => {
  const cacheControl = getCacheControl(
    req.path,
    req.method,
    Boolean(req.headers.authorization)
  );
  res.set('Cache-Control', cacheControl);
  return next();
};
