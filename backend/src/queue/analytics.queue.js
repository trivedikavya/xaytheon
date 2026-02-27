const { Queue } = require('bullmq');
const connection = require('./connection');
const { processAnalyticsJob } = require('../services/analytics.processor');

let analyticsQueue;

try {
    analyticsQueue = new Queue('analytics-processing', {
        connection,
        defaultJobOptions: {
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            timeout: 60000,
            removeOnComplete: { age: 3600 },
            removeOnFail: { age: 86400 }
        }
    });

    analyticsQueue.on('error', (err) => {
        // Suppress unhandled redis errors in queue
        console.warn('Queue Redis Error:', err);
    });
} catch (err) {
    console.warn("⚠️ Failed to initialize BullMQ Queue (Redis missing?):", err);
}

/**
 * Add a job to the analytics queue
 * @param {string} userId - The ID of the user request
 * @param {string} githubUsername - The GitHub username to analyze
 */
const addAnalyticsJob = async (userId, githubUsername) => {
    try {
        if (!analyticsQueue) {
            throw new Error('Queue not initialized');
        }

        const jobId = `${userId}:${githubUsername}`;

        return await analyticsQueue.add(
            'process-analytics',
            {
                userId,
                githubUsername
            },
            {
                jobId
            }
        );

    } catch (err) {
        console.error(`❌ Queue unavailable (${err.message}). Job not executed.`);
        throw err;
    }
};

module.exports = {
    analyticsQueue,
    addAnalyticsJob
};
