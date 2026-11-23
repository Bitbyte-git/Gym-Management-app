const Redis = require('ioredis');

let redisClient = null;
let isReady = false;

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisUrl = process.env.REDIS_URL;
const isRedisEnabled = process.env.REDIS_ENABLED !== 'false';

if (isRedisEnabled) {
  try {
    const options = {
      retryStrategy(times) {
        // Exponential backoff with max 5s interval
        const delay = Math.min(times * 150, 5000);
        return delay;
      },
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false, // Don't hang requests if Redis is temporarily offline
      lazyConnect: true,
    };

    if (redisPassword) options.password = redisPassword;

    redisClient = redisUrl
      ? new Redis(redisUrl, options)
      : new Redis({ host: redisHost, port: redisPort, ...options });

    redisClient.on('connect', () => {
      console.log(`[Redis] Connected to Redis at ${redisHost}:${redisPort}`);
      isReady = true;
    });

    redisClient.on('ready', () => {
      isReady = true;
    });

    redisClient.on('error', (err) => {
      // Graceful error logging without crashing process
      if (isReady) {
        console.warn(`[Redis] Connection warning: ${err.message}`);
      }
      isReady = false;
    });

    redisClient.on('close', () => {
      isReady = false;
    });

    // Attempt initial connect asynchronously
    redisClient.connect().catch((err) => {
      console.warn(`[Redis] Standalone Redis not reachable (${err.message}). Falling back to in-memory mode.`);
      isReady = false;
    });
  } catch (err) {
    console.warn(`[Redis] Initialization warning: ${err.message}. Operating in fallback mode.`);
    redisClient = null;
    isReady = false;
  }
} else {
  console.log('[Redis] Disabled via REDIS_ENABLED=false');
}

module.exports = {
  getRedisClient: () => redisClient,
  isRedisReady: () => isReady && redisClient !== null,
};
