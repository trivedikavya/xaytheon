/**
 * Event Aggregator Service
 * Batches high-frequency GitHub webhooks for smooth visualization
 */

const EventEmitter = require('events');

class EventAggregator extends EventEmitter {
    constructor(geospatialService, options = {}) {
        super();
        this.geospatialService = geospatialService;

        // Configuration
        this.batchInterval = options.batchInterval || 100; // ms
        this.maxBatchSize = options.maxBatchSize || 50;
        this.eventTTL = options.eventTTL || 60000; // 1 minute

        // State
        this.pendingEvents = [];
        this.eventHistory = new Map();
        this.statistics = {
            totalProcessed: 0,
            batchesSent: 0,
            eventsDropped: 0,
            averageBatchSize: 0
        };

        // Rate limiting
        this.rateLimiter = {
            windowMs: 1000,
            maxEvents: 1000,
            window: [],
            windowStart: Date.now()
        };

        // Start batch processor
        this.startBatchProcessor();

        // Start cleanup routine
        this.startCleanupRoutine();
    }

    /**
     * Add GitHub event to aggregator
     */
    async addEvent(event) {
        try {
            // Rate limiting check
            if (!this.checkRateLimit()) {
                this.statistics.eventsDropped++;
                return false;
            }

            // Deduplicate events
            const eventId = this.generateEventId(event);
            if (this.eventHistory.has(eventId)) {
                return false; // Duplicate event
            }

            // Enrich event data
            const enrichedEvent = await this.enrichEvent(event);

            // Add to pending batch
            this.pendingEvents.push(enrichedEvent);

            // Track in history
            this.eventHistory.set(eventId, {
                timestamp: Date.now(),
                type: enrichedEvent.type
            });

            this.statistics.totalProcessed++;

            // Process immediately if batch is full
            if (this.pendingEvents.length >= this.maxBatchSize) {
                this.processBatch();
            }

            return true;
        } catch (error) {
            console.error('Error adding event to aggregator:', error);
            return false;
        }
    }

    /**
     * Generate unique event ID for deduplication
     */
    generateEventId(event) {
        const repo = event.repo?.name || event.repository?.full_name || 'unknown';
        const type = event.type || 'unknown';
        const timestamp = event.created_at || new Date().toISOString();
        const actor = event.actor?.login || event.sender?.login || 'unknown';

        return `${repo}-${type}-${actor}-${timestamp}`;
    }

    /**
     * Enrich event with additional metadata
     */
    async enrichEvent(event) {
        const enriched = {
            ...event,
            processedAt: Date.now(),
            priority: this.calculateEventPriority(event)
        };

        // Add trending score if available
        enriched.trending = await this.calculateTrendingScore(event);

        return enriched;
    }

    /**
     * Calculate event priority for processing order
     */
    calculateEventPriority(event) {
        const type = event.type || '';

        // High priority events
        if (type.includes('Release')) return 3;
        if (type.includes('PullRequest')) return 2;
        if (type.includes('Push')) return 2;

        // Medium priority
        if (type.includes('Issue')) return 1;
        if (type.includes('Star')) return 1;

        // Low priority
        return 0;
    }

    /**
     * Calculate trending score based on recent activity
     */
    async calculateTrendingScore(event) {
        const repo = event.repo?.name || event.repository?.full_name;
        if (!repo) return 0;

        // Count recent events for this repo
        const recentEvents = Array.from(this.eventHistory.values())
            .filter(e => e.timestamp > Date.now() - 300000); // Last 5 minutes

        const repoEvents = recentEvents.filter(e => e.repo === repo);

        // Simple trending score: events in last 5 minutes
        return Math.min(repoEvents.length / 10, 1); // Normalized to 0-1
    }

    /**
     * Check rate limiting
     */
    checkRateLimit() {
        const now = Date.now();
        const { windowMs, maxEvents } = this.rateLimiter;

        // Reset window if expired
        if (now - this.rateLimiter.windowStart > windowMs) {
            this.rateLimiter.window = [];
            this.rateLimiter.windowStart = now;
        }

        // Check if under limit
        if (this.rateLimiter.window.length < maxEvents) {
            this.rateLimiter.window.push(now);
            return true;
        }

        return false;
    }

    /**
     * Start batch processing interval
     */
    startBatchProcessor() {
        this.batchInterval = setInterval(() => {
            if (this.pendingEvents.length > 0) {
                this.processBatch();
            }
        }, this.batchInterval);
    }

    /**
     * Process pending events batch
     */
    processBatch() {
        if (this.pendingEvents.length === 0) return;

        // Sort by priority
        const sortedEvents = this.pendingEvents.sort((a, b) => b.priority - a.priority);

        // Take batch
        const batch = sortedEvents.slice(0, this.maxBatchSize);
        this.pendingEvents = sortedEvents.slice(this.maxBatchSize);

        // Update statistics
        this.statistics.batchesSent++;
        this.statistics.averageBatchSize =
            (this.statistics.averageBatchSize * (this.statistics.batchesSent - 1) + batch.length)
            / this.statistics.batchesSent;

        // Send to geospatial service
        this.sendBatch(batch);
    }

    /**
     * Send batch to geospatial service
     */
    async sendBatch(events) {
        try {
            // Process each event through geospatial service
            const promises = events.map(event =>
                this.geospatialService.processGitHubEvent(event)
            );

            await Promise.all(promises);

            // Emit batch processed event
            this.emit('batch:processed', {
                count: events.length,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Error sending batch:', error);
            this.emit('batch:error', error);
        }
    }

    /**
     * Start cleanup routine for old events
     */
    startCleanupRoutine() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupHistory();
        }, 60000); // Every minute
    }

    /**
     * Clean up old event history
     */
    cleanupHistory() {
        const now = Date.now();
        let cleaned = 0;

        for (const [eventId, event] of this.eventHistory.entries()) {
            if (now - event.timestamp > this.eventTTL) {
                this.eventHistory.delete(eventId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`Cleaned up ${cleaned} old events from history`);
        }
    }

    /**
     * Get aggregator statistics
     */
    getStatistics() {
        return {
            ...this.statistics,
            pendingEvents: this.pendingEvents.length,
            historySize: this.eventHistory.size,
            rateLimitWindow: this.rateLimiter.window.length
        };
    }

    /**
     * Flush all pending events immediately
     */
    flush() {
        while (this.pendingEvents.length > 0) {
            this.processBatch();
        }
    }

    /**
     * Simulate live events for testing/demo
     */
    simulateLiveEvents(config = {}) {
        const {
            eventsPerSecond = 10,
            duration = 60000, // 1 minute
            eventTypes = ['PushEvent', 'PullRequestEvent', 'IssuesEvent', 'StarEvent']
        } = config;

        const interval = 1000 / eventsPerSecond;
        let elapsed = 0;

        const simulationInterval = setInterval(() => {
            if (elapsed >= duration) {
                clearInterval(simulationInterval);
                console.log('Event simulation completed');
                return;
            }

            // Generate random event
            const event = this.generateRandomEvent(eventTypes);
            this.addEvent(event);

            elapsed += interval;
        }, interval);

        return simulationInterval;
    }

    /**
     * Generate random event for simulation
     */
    generateRandomEvent(eventTypes) {
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const languages = ['JavaScript', 'Python', 'Java', 'Go', 'TypeScript', 'Rust', 'C++'];
        const repos = [
            'facebook/react', 'microsoft/vscode', 'torvalds/linux',
            'kubernetes/kubernetes', 'tensorflow/tensorflow', 'nodejs/node'
        ];

        return {
            id: `sim-${Date.now()}-${Math.random()}`,
            type,
            created_at: new Date().toISOString(),
            repo: {
                name: repos[Math.floor(Math.random() * repos.length)]
            },
            actor: {
                login: `user${Math.floor(Math.random() * 1000)}`
            },
            repository: {
                language: languages[Math.floor(Math.random() * languages.length)],
                full_name: repos[Math.floor(Math.random() * repos.length)]
            },
            payload: this.generateRandomPayload(type)
        };
    }

    /**
     * Generate random payload based on event type
     */
    generateRandomPayload(type) {
        switch (type) {
            case 'PushEvent':
                return { commits: Array(Math.floor(Math.random() * 5) + 1).fill({}), ref: 'refs/heads/main' };
            case 'PullRequestEvent':
                return { action: Math.random() > 0.5 ? 'opened' : 'closed', pull_request: { number: Math.floor(Math.random() * 1000), title: 'Test PR' } };
            case 'IssuesEvent':
                return { action: Math.random() > 0.5 ? 'opened' : 'closed', issue: { number: Math.floor(Math.random() * 1000), title: 'Test Issue' } };
            default:
                return {};
        }
    }

    // ─── Issue #615: Per-User Filtering, Priority Scoring & Delivery Receipts ────

    /**
     * Per-user filter preferences storage.
     * userId -> { minPriority, allowedTypes, channels }
     */
    _userFilters = new Map();

    /**
     * Delivery receipt store.
     * receiptToken -> { userId, eventId, status, attempts, lastAttempt }
     */
    _deliveryReceipts = new Map();

    /**
     * Retry queue for failed deliveries.
     * [{ receiptToken, event, userId, attempt, nextRetry }]
     */
    _retryQueue = [];

    /**
     * Set per-user notification filter preferences.
     * @param {string} userId
     * @param {Object} prefs  - { minPriority, allowedTypes, channels }
     */
    setUserFilter(userId, prefs = {}) {
        this._userFilters.set(userId, {
            minPriority: prefs.minPriority ?? 0,
            allowedTypes: prefs.allowedTypes ?? null, // null = allow all
            channels: prefs.channels ?? ['socket', 'push'],       // which pipelines
            digestMode: prefs.digestMode ?? false // batch into digest vs immediate
        });
    }

    /**
     * Get user filter preferences.
     */
    getUserFilter(userId) {
        return this._userFilters.get(userId) || { minPriority: 0, allowedTypes: null, channels: ['socket', 'push'], digestMode: false };
    }

    /**
     * Test whether an event passes a user's filter.
     * @param {string} userId
     * @param {Object} event
     * @returns {boolean}
     */
    eventPassesFilter(userId, event) {
        const filter = this.getUserFilter(userId);
        if ((event.priority || 0) < filter.minPriority) return false;
        if (filter.allowedTypes && !filter.allowedTypes.includes(event.type)) return false;
        return true;
    }

    /**
     * Calculate a composite delivery priority score for an event.
     * Score factors: base priority (40%) + recency (30%) + trending (30%).
     * @param {Object} event
     * @returns {number} 0-10 score
     */
    calculateDeliveryPriority(event) {
        const base = Math.min(10, (event.priority || 0) * 1.2);
        const recency = Math.max(0, 10 - Math.floor((Date.now() - (event.processedAt || Date.now())) / 6000));  // decays per minute
        const trending = Math.min(10, (event.trending || 0) * 10);
        return parseFloat((base * 0.4 + recency * 0.3 + trending * 0.3).toFixed(2));
    }

    /**
     * Issue a delivery receipt token for an outgoing notification.
     * @param {string} userId
     * @param {string} eventId
     * @param {string} channel  - 'socket' | 'push' | 'email'
     * @returns {string} receiptToken
     */
    issueDeliveryReceipt(userId, eventId, channel = 'socket') {
        const token = `rcpt_${userId}_${eventId}_${Date.now()}`;
        this._deliveryReceipts.set(token, {
            token, userId, eventId, channel,
            status: 'pending',
            issuedAt: Date.now(),
            ackedAt: null,
            attempts: 1,
            lastAttempt: Date.now()
        });
        return token;
    }

    /**
     * Acknowledge a delivery receipt (mark as delivered).
     * @param {string} token
     * @returns {boolean}
     */
    acknowledgeReceipt(token) {
        const rcpt = this._deliveryReceipts.get(token);
        if (!rcpt) return false;
        rcpt.status = 'delivered';
        rcpt.ackedAt = Date.now();
        this.emit('receipt:acked', rcpt);
        return true;
    }

    /**
     * Record a delivery failure and enqueue for exponential backoff retry.
     * @param {string} token
     * @param {Object} event
     * @param {string} reason
     */
    recordDeliveryFailure(token, event, reason = '') {
        const rcpt = this._deliveryReceipts.get(token);
        if (!rcpt) return;

        rcpt.status = 'failed';
        rcpt.lastFailure = reason;

        const MAX_ATTEMPTS = 5;
        if (rcpt.attempts >= MAX_ATTEMPTS) {
            rcpt.status = 'dead_letter';
            this.emit('receipt:dead_letter', rcpt);
            return;
        }

        // Exponential backoff: 2^attempt * 5s
        const delayMs = Math.pow(2, rcpt.attempts) * 5000;
        this._retryQueue.push({
            token, event, userId: rcpt.userId,
            attempt: rcpt.attempts,
            nextRetry: Date.now() + delayMs
        });
        rcpt.attempts++;
        rcpt.lastAttempt = Date.now();
        this.emit('receipt:retry_scheduled', { token, delayMs, attempt: rcpt.attempts });
    }

    /**
     * Drain retry queue: returns items that are due for retry now.
     * Call this on a periodic interval (e.g. every 10s).
     * @returns {Array} items ready for retry
     */
    drainRetryQueue() {
        const now = Date.now();
        const due = this._retryQueue.filter(item => item.nextRetry <= now);
        this._retryQueue = this._retryQueue.filter(item => item.nextRetry > now);
        return due;
    }

    /**
     * Get receipt states for a user (for frontend traceability panel).
     * @param {string} userId
     * @returns {Array}
     */
    getUserReceipts(userId) {
        const results = [];
        for (const rcpt of this._deliveryReceipts.values()) {
            if (rcpt.userId === userId) results.push(rcpt);
        }
        return results.sort((a, b) => b.issuedAt - a.issuedAt).slice(0, 50);
    }

    /**
     * Get global retry queue stats.
     */
    getRetryStats() {
        const grouped = {};
        this._retryQueue.forEach(item => {
            grouped[item.attempt] = (grouped[item.attempt] || 0) + 1;
        });
        return { totalPending: this._retryQueue.length, byAttempt: grouped };
    }

    /**
     * Stop aggregator
     */
    stop() {
        if (this.batchInterval) clearInterval(this.batchInterval);
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        this.flush();
    }
}

module.exports = EventAggregator;
