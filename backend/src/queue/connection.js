const IORedis = require('ioredis');

// Default Redis configuration
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
    connectTimeout: 10000,
    enableReadyCheck: true,
    retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
    }
});

connection.on('connect', () => {
    console.log('✅ Redis connected');
});

connection.on('error', (err) => {
    console.error('❌ Redis error:', err);
});

connection.on('reconnecting', () => {
    console.warn('🔄 Redis reconnecting...');
});

connection.on('close', () => {
    console.warn('⚠️ Redis connection terminated');
});

module.exports = connection;
