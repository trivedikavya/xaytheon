/**
 * CacheManager - Client-side caching with expiry
 * Handles localStorage/sessionStorage with automatic expiration
 */

class CacheManager {
    constructor(options = {}) {
        this.storage = options.storage || localStorage; // or sessionStorage
        this.defaultTTL = options.defaultTTL ?? 30 * 60 * 1000; // 30 minutes in milliseconds
        this.prefix = options.prefix || 'xaytheon_cache_';
        this.enableLogging = options.enableLogging ?? false;
        this.version = options.version ?? '1';
        this.autoPrune = options.autoPrune ?? true;
        this.maxEvictionRetries = options.maxEvictionRetries ?? 10;

        this._cleanupOldVersions();
    }

    /**
     * Generate cache key with prefix
     */
    _getKey(key) {
        return `${this.prefix}v${this.version}_${key}`;
    }

    _getVersionPrefix() {
        return `${this.prefix}v${this.version}_`;
    }

    /**
     * Log cache operations (if enabled)
     */
    _log(message, data) {
        if (this.enableLogging) {
            console.log(`[CacheManager] ${message}`, data || '');
        }
    }

    _safeParse(key, value) {
        try {
            return JSON.parse(value);
        } catch {
            this.storage.removeItem(key);
            return null;
        }
    }

    _cleanupOldVersions() {
        const currentPrefix = this._getVersionPrefix();
        for (let i = this.storage.length - 1; i >= 0; i--) {
            const key = this.storage.key(i);
            if (key && key.startsWith(this.prefix) && !key.startsWith(currentPrefix)) {
                this.storage.removeItem(key);
            }
        }
    }

    _evictOldest() {
        let oldestKey = null;
        let oldestAccess = Infinity;

        for (let i = 0; i < this.storage.length; i++) {
            const key = this.storage.key(i);
            if (key && key.startsWith(this._getVersionPrefix())) {
                const cached = this.storage.getItem(key);
                if (!cached) continue;

                const parsed = this._safeParse(key, cached);
                if (!parsed) continue;

                const accessTime = parsed.lastAccess ?? parsed.timestamp;
                if (accessTime < oldestAccess) {
                    oldestAccess = accessTime;
                    oldestKey = key;
                }
            }
        }

        if (oldestKey) {
            this.storage.removeItem(oldestKey);
            this._log(`Evicted oldest cache entry`, oldestKey);
            return true;
        }

        return false;
    }

    /**
     * Set cache with expiry
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    set(key, data, ttl = null) {
        if (this.autoPrune) {
            this.clearExpired();
        }

        const cacheKey = this._getKey(key);
        const now = Date.now();
        const expiryTime = now + (ttl ?? this.defaultTTL);

        const cacheData = {
            data: data,
            timestamp: now,
            lastAccess: now,
            expiry: expiryTime
        };

        const serialized = JSON.stringify(cacheData);

        let attempts = 0;
        while (attempts <= this.maxEvictionRetries) {
            try {
                this.storage.setItem(cacheKey, serialized);
                this._log(`Cache SET: ${key}`, { expiryTime: new Date(expiryTime) });
                return true;
            } catch (error) {
                if (error.name !== 'QuotaExceededError') {
                    console.error('[CacheManager] Error setting cache:', error);
                    return false;
                }

                this._log('Quota exceeded, attempting eviction');
                if (!this._evictOldest()) {
                    return false;
                }

                attempts++;
            }
        }

        return false;
    }

    /**
     * Get cached data if not expired
     * @param {string} key - Cache key
     * @returns {any|null} - Cached data or null if expired/not found
     */
    get(key) {
        try {
            const cacheKey = this._getKey(key);
            const cached = this.storage.getItem(cacheKey);

            if (!cached) {
                this._log(`Cache MISS: ${key}`);
                return null;
            }

            const cacheData = this._safeParse(cacheKey, cached);
            if (!cacheData) return null;

            const now = Date.now();

            // Check if expired
            if (now > cacheData.expiry) {
                this._log(`Cache EXPIRED: ${key}`);
                this.storage.removeItem(cacheKey);
                return null;
            }

            cacheData.lastAccess = now;
            this.storage.setItem(cacheKey, JSON.stringify(cacheData));

            this._log(`Cache HIT: ${key}`, { age: now - cacheData.timestamp });
            return cacheData.data;
        } catch (error) {
            console.error('[CacheManager] Error getting cache:', error);
            return null;
        }
    }

    /**
     * Remove specific cache entry
     */
    remove(key) {
        const cacheKey = this._getKey(key);
        this.storage.removeItem(cacheKey);
        this._log(`Cache REMOVED: ${key}`);
    }

    /**
     * Clear all expired cache entries
     */
    clearExpired() {
        try {
            const now = Date.now();
            let clearedCount = 0;

            for (let i = this.storage.length - 1; i >= 0; i--) {
                const key = this.storage.key(i);

                if (key && key.startsWith(this._getVersionPrefix())) {
                    const cached = this.storage.getItem(key);
                    if (!cached) continue;

                    const cacheData = this._safeParse(key, cached);
                    if (!cacheData || now > cacheData.expiry) {
                        this.storage.removeItem(key);
                        clearedCount++;
                    }
                }
            }

            this._log(`Cleared ${clearedCount} expired cache entries`);
            return clearedCount;
        } catch (error) {
            console.error('[CacheManager] Error clearing expired cache:', error);
            return 0;
        }
    }

    /**
     * Clear all cache entries (for this app)
     */
    clearAll() {
        try {
            const keys = [];
            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i);
                if (key && key.startsWith(this._getVersionPrefix())) {
                    keys.push(key);
                }
            }

            keys.forEach(key => this.storage.removeItem(key));
            this._log(`Cleared all cache (${keys.length} entries)`);
            return keys.length;
        } catch (error) {
            console.error('[CacheManager] Error clearing all cache:', error);
            return 0;
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        try {
            let totalEntries = 0;
            let expiredEntries = 0;
            let totalSize = 0;
            const now = Date.now();

            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i);

                if (key && key.startsWith(this._getVersionPrefix())) {
                    totalEntries++;
                    const cached = this.storage.getItem(key);
                    if (!cached) continue;

                    totalSize += new Blob([cached]).size;

                    const cacheData = this._safeParse(key, cached);
                    if (!cacheData || now > cacheData.expiry) {
                        expiredEntries++;
                    }
                }
            }

            return {
                totalEntries,
                expiredEntries,
                activeEntries: totalEntries - expiredEntries,
                totalSizeKB: (totalSize / 1024).toFixed(2)
            };
        } catch (error) {
            console.error('[CacheManager] Error getting stats:', error);
            return null;
        }
    }

    /**
     * Check if cache exists and is valid
     */
    has(key) {
        const cacheKey = this._getKey(key);
        const cached = this.storage.getItem(cacheKey);
        if (!cached) return false;

        const cacheData = this._safeParse(cacheKey, cached);
        if (!cacheData) return false;

        return Date.now() <= cacheData.expiry;
    }

    /**
     * Get remaining TTL for a cache entry
     */
    getTTL(key) {
        try {
            const cacheKey = this._getKey(key);
            const cached = this.storage.getItem(cacheKey);

            if (!cached) return 0;

            const cacheData = this._safeParse(cacheKey, cached);
            if (!cacheData) return 0;

            const remaining = cacheData.expiry - Date.now();
            return remaining > 0 ? remaining : 0;
        } catch {
            return 0;
        }
    }
}

// Create default instance
const defaultCache = new CacheManager({
    storage: localStorage,
    defaultTTL: 30 * 60 * 1000, // 30 minutes
    enableLogging: false, // Set to false in production
    version: '1'
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
}
