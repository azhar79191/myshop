export const createRateLimiter = ({ limit, windowMs, maxKeys = 10000, now = Date.now }) => {
  const windows = new Map();
  let lastCleanup = 0;
  return (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const timestamp = now();
    if (timestamp - lastCleanup >= 60000 || windows.size >= maxKeys) {
      for (const [key, value] of windows) if (value.resetAt <= timestamp) windows.delete(key);
      lastCleanup = timestamp;
    }
    const key = req.ip || req.socket.remoteAddress;
    let entry = windows.get(key);
    if (!entry || entry.resetAt <= timestamp) {
      if (windows.size >= maxKeys) {
        res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
        return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
      }
      entry = { count: 0, resetAt: timestamp + windowMs };
      windows.set(key, entry);
    }
    entry.count += 1;
    res.set('RateLimit-Limit', String(limit));
    res.set('RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
    if (entry.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000))));
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }
    return next();
  };
};

export const loginRateLimit = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
export const submissionRateLimit = createRateLimiter({ limit: 20, windowMs: 15 * 60 * 1000 });
