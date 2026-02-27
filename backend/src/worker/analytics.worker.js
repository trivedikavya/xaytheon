const { Worker } = require('bullmq');
const connection = require('../queue/connection');
const { processAnalyticsJob } = require('../services/analytics.processor');

let isShuttingDown = false;

try {
    const startWorker = async () => {
        // Explicit Redis health check
        if (typeof connection.ping === 'function') {
            await connection.ping();
        }

        const worker = new Worker(
            'analytics-processing',
            async job => {
                return processAnalyticsJob({
                    ...job.data,
                    jobId: job.id
                });
            },
            {
                connection,
                concurrency: parseInt(process.env.ANALYTICS_WORKER_CONCURRENCY, 10) || 5
            }
        );

        const flushAndExit = async (code) => {
            try {
                if (global.logger?.flush) {
                    await global.logger.flush();
                }
            } finally {
                process.exit(code);
            }
        };

        worker.on('completed', job => {
            console.log(JSON.stringify({
                level: 'info',
                event: 'job_completed',
                jobId: job?.id,
                timestamp: new Date().toISOString()
            }));
        });

        worker.on('failed', (job, err) => {
            console.error(JSON.stringify({
                level: 'error',
                event: 'job_failed',
                jobId: job?.id,
                attemptsMade: job?.attemptsMade,
                error: err?.message,
                stack: err?.stack,
                timestamp: new Date().toISOString()
            }));
        });

        worker.on('error', async err => {
            console.error(JSON.stringify({
                level: 'fatal',
                event: 'worker_error',
                error: err?.message,
                stack: err?.stack,
                timestamp: new Date().toISOString()
            }));
            await flushAndExit(1);
        });

        const timeoutPromise = (ms) =>
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Worker shutdown timeout')), ms)
            );

        const shutdown = async () => {
            if (isShuttingDown) return;
            isShuttingDown = true;

            try {
                await Promise.race([
                    worker.close(),
                    timeoutPromise(5000)
                ]);
            } catch (err) {
                console.error(JSON.stringify({
                    level: 'error',
                    event: 'worker_shutdown_error',
                    error: err?.message,
                    stack: err?.stack,
                    timestamp: new Date().toISOString()
                }));
            } finally {
                await flushAndExit(0);
            }
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        process.on('unhandledRejection', async err => {
            console.error(JSON.stringify({
                level: 'fatal',
                event: 'unhandled_rejection',
                error: err?.message,
                stack: err?.stack,
                timestamp: new Date().toISOString()
            }));
            await flushAndExit(1);
        });

        process.on('uncaughtException', async err => {
            console.error(JSON.stringify({
                level: 'fatal',
                event: 'uncaught_exception',
                error: err?.message,
                stack: err?.stack,
                timestamp: new Date().toISOString()
            }));
            await flushAndExit(1);
        });

        module.exports = worker;
    };

    startWorker().catch(err => {
        console.error(JSON.stringify({
            level: 'fatal',
            event: 'worker_startup_failed',
            error: err?.message,
            stack: err?.stack,
            timestamp: new Date().toISOString()
        }));
        process.exit(1);
    });

} catch (err) {
    console.error(JSON.stringify({
        level: 'fatal',
        event: 'worker_initialization_failed',
        error: err?.message,
        stack: err?.stack,
        timestamp: new Date().toISOString()
    }));
    process.exit(1);
}
