const Redis = require('ioredis');

let redis;

const getRedis = () => {
  if (!redis) {
    try {
      redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        lazyConnect: true,
        enableOfflineQueue: false,
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Disable automatic retries completely
      });

      redis.on('error', () => {
        // Silently swallow Redis errors — in-memory fallback handles it
        redis = null;
      });
    } catch (e) {
      redis = null;
    }
  }
  return redis;
};

// In-memory fallback counter when Redis is unavailable
const memoryStore = new Map();

const quoteLimiter = async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next();

  const key = `quote_requests:${userId}`;
  const limit = 10;

  const client = getRedis();

  try {
    if (client) {
      // Redis-based rate limiting (resets daily via TTL)
      const count = await client.incr(key);
      if (count === 1) {
        // Set expiry to end of day (86400s)
        await client.expire(key, 86400);
      }
      if (count > limit) {
        return res.status(429).json({
          error: `Quote request limit reached. You can send a maximum of ${limit} requests per day.`,
        });
      }
    } else {
      // In-memory fallback
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const entry = memoryStore.get(key) || { count: 0, resetAt: now + dayMs };

      if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + dayMs;
      }

      entry.count++;
      memoryStore.set(key, entry);

      if (entry.count > limit) {
        return res.status(429).json({
          error: `Quote request limit reached. You can send a maximum of ${limit} requests per day.`,
        });
      }
    }
  } catch (err) {
    console.warn('Rate limiter error:', err.message);
    // Let request through if rate limiter errors
  }

  next();
};

module.exports = { quoteLimiter };
