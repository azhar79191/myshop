/**
 * Simple in-memory cache middleware for API responses
 * Reduces database queries for frequently accessed data
 */

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Cache middleware
 * @param {number} duration - Cache duration in seconds (default: 300)
 */
export const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Create cache key from URL and query params
    const cacheKey = `${req.originalUrl || req.url}`;
    const cached = cache.get(cacheKey);

    // Check if cache exists and is still valid
    if (cached && Date.now() - cached.timestamp < duration * 1000) {
      console.log(`[CACHE HIT] ${cacheKey}`);
      return res.status(200).json(cached.data);
    }

    // Store original res.json function
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = (data) => {
      // Only cache successful responses
      if (res.statusCode === 200) {
        cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });
        console.log(`[CACHE SET] ${cacheKey}`);
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Clear cache for specific pattern
 */
export const clearCache = (pattern = null) => {
  if (!pattern) {
    cache.clear();
    console.log('[CACHE] Cleared all cache');
    return;
  }

  const keys = Array.from(cache.keys());
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.delete(key);
      console.log(`[CACHE] Cleared: ${key}`);
    }
  });
};

/**
 * Clear cache middleware (for POST, PUT, DELETE requests)
 */
export const clearCacheMiddleware = (patterns = []) => {
  return (req, res, next) => {
    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to clear cache after successful mutation
    res.json = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach(pattern => clearCache(pattern));
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  const now = Date.now();
  const entries = Array.from(cache.entries());
  
  return {
    totalEntries: cache.size,
    validEntries: entries.filter(([_, value]) => now - value.timestamp < CACHE_DURATION).length,
    expiredEntries: entries.filter(([_, value]) => now - value.timestamp >= CACHE_DURATION).length,
    memoryUsage: process.memoryUsage(),
  };
};

/**
 * Clean expired cache entries (run periodically)
 */
export const cleanExpiredCache = () => {
  const now = Date.now();
  const entries = Array.from(cache.entries());
  let cleaned = 0;

  entries.forEach(([key, value]) => {
    if (now - value.timestamp >= CACHE_DURATION) {
      cache.delete(key);
      cleaned++;
    }
  });

  if (cleaned > 0) {
    console.log(`[CACHE] Cleaned ${cleaned} expired entries`);
  }
};

// Clean expired cache every 10 minutes
setInterval(cleanExpiredCache, 10 * 60 * 1000);

export default cacheMiddleware;
