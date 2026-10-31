const Redis = require("ioredis");

let redisClient = null;
let isRedisConnected = false;
const memoryCache = new Map();

const initRedis = () => {
    const redisUrl = process.env.REDIS_URI || process.env.REDIS_URL;
    if (!redisUrl) {
        console.log("ℹ️ REDIS_URI not configured. Using high-performance in-memory cache adapter.");
        return null;
    }

    try {
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) {
                    console.warn("⚠️ Redis connection failed 3 times. Falling back to in-memory cache.");
                    return null;
                }
                return Math.min(times * 200, 1000);
            }
        });

        redisClient.on("connect", () => {
            isRedisConnected = true;
            console.log("🔴 Redis Cache & Live Session Bus Connected");
        });

        redisClient.on("error", (err) => {
            isRedisConnected = false;
            console.warn("Redis error warning:", err.message);
        });

        return redisClient;
    } catch (err) {
        console.warn("Redis initialization warning:", err.message);
        return null;
    }
};

const setCache = async (key, value, ttlSeconds = 3600) => {
    try {
        const serialized = JSON.stringify(value);
        if (isRedisConnected && redisClient) {
            await redisClient.set(key, serialized, "EX", ttlSeconds);
        } else {
            memoryCache.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
        }
    } catch (err) {
        console.warn(`Cache set error [${key}]:`, err.message);
    }
};

const getCache = async (key) => {
    try {
        if (isRedisConnected && redisClient) {
            const raw = await redisClient.get(key);
            return raw ? JSON.parse(raw) : null;
        }
        const cached = memoryCache.get(key);
        if (!cached) return null;
        if (Date.now() > cached.expiresAt) {
            memoryCache.delete(key);
            return null;
        }
        return JSON.parse(cached.value);
    } catch (err) {
        return null;
    }
};

const deleteCache = async (key) => {
    try {
        if (isRedisConnected && redisClient) {
            await redisClient.del(key);
        }
        memoryCache.delete(key);
    } catch (err) {
        console.warn(`Cache delete error [${key}]:`, err.message);
    }
};

module.exports = {
    initRedis,
    setCache,
    getCache,
    deleteCache,
    isRedisActive: () => isRedisConnected
};
