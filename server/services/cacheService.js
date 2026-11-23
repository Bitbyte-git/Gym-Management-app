const { getRedisClient, isRedisReady } = require('../config/redis');

// In-memory fallback map for when Redis is unavailable or in development
const memoryCache = new Map();

/**
 * Cache-aside service with automatic fallback to memory or direct DB fetch
 */
const cacheService = {
  /**
   * Get value from cache (Redis -> Memory -> null)
   */
  async get(key) {
    if (isRedisReady()) {
      try {
        const data = await getRedisClient().get(key);
        if (data) return JSON.parse(data);
      } catch (err) {
        console.warn(`[Cache] Redis get error for key "${key}": ${err.message}`);
      }
    }

    // Memory fallback check
    const entry = memoryCache.get(key);
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        return entry.value;
      }
      memoryCache.delete(key);
    }
    return null;
  },

  /**
   * Set value in cache with TTL in seconds (default 1 hour)
   */
  async set(key, value, ttlSeconds = 3600) {
    const serialized = JSON.stringify(value);

    if (isRedisReady()) {
      try {
        await getRedisClient().set(key, serialized, 'EX', ttlSeconds);
        return true;
      } catch (err) {
        console.warn(`[Cache] Redis set error for key "${key}": ${err.message}`);
      }
    }

    // Memory fallback set
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  },

  /**
   * Delete key from cache
   */
  async del(key) {
    memoryCache.delete(key);
    if (isRedisReady()) {
      try {
        await getRedisClient().del(key);
      } catch (err) {
        console.warn(`[Cache] Redis del error for key "${key}": ${err.message}`);
      }
    }
  },

  /**
   * Invalidate multiple keys by pattern (e.g., 'gym:plans:*')
   */
  async delPattern(pattern) {
    // Clear matching from memory
    const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) memoryCache.delete(key);
    }

    if (isRedisReady()) {
      try {
        const client = getRedisClient();
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } catch (err) {
        console.warn(`[Cache] Redis delPattern error: ${err.message}`);
      }
    }
  },

  /**
   * Wrap an async DB function with Cache-Aside pattern
   */
  async wrap(key, ttlSeconds, fetchFunction) {
    const cached = await this.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const fresh = await fetchFunction();
    if (fresh !== null && fresh !== undefined) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  },
};

module.exports = cacheService;
