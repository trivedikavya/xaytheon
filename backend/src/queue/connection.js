const IORedis = require('ioredis');

// Default Redis configuration
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
    connectTimeout: 5000,
    enableReadyCheck: true,
    retryStrategy(times) {
        if (times > 3) {
            console.warn('⚠️  Redis unavailable — running without background queue (this is OK for local dev).');
            return null; // Stop retrying
        }
        return Math.min(times * 500, 2000);
    },
    // Suppress noisy reconnect logs
    lazyConnect: false,
});

let redisErrorLogged = false;

connection.on('connect', () => {
    console.log('✅ Redis connected');
    redisErrorLogged = false;
});

connection.on('error', (err) => {
    if (!redisErrorLogged) {
        console.warn('⚠️  Redis not available:', err.code || err.message);
        redisErrorLogged = true;
    }
    // Suppress repeated error logs
});

connection.on('close', () => {
    // Only log once
    if (!redisErrorLogged) {
        console.warn('⚠️  Redis connection closed');
    }
});

module.exports = connection;
