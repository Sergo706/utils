/** Controls when a job is flushed. `'immediate'` triggers a flush right away; `'deferred'` waits for the next timed or size-triggered flush. */
export type Priority = 'immediate' | 'deferred';

/**
 * Configuration options for {@link BatchQueue}.
 * All fields are optional — sensible defaults are applied when omitted.
 */
export interface BatchQueueOptions {
    /**
     * Maximum number of queued jobs before an automatic flush is triggered.
     * @default 100
     */
    maxBufferSize?: number;
    /**
     * How long to wait (in milliseconds) before flushing a non-full buffer.
     * @default 5000
     */
    flushIntervalMs?: number;
    /**
     * Number of times a failed flush is retried before the batch is discarded.
     * @default 3
     */
    maxRetries?: number;
    /**
     * Logger used for error and info output.
     * Accepts any object with `error` and `info` methods (e.g. a pino child logger or `console`).
     * @default console
     */
    logger?: Pick<Console, 'error' | 'info'>;
}

interface BatchJob<T> {
    id: string;
    priority: Priority;
    params: T;
}

/**
 * A generic, in-memory batch queue that collects jobs and processes them in bulk.
 *
 * Jobs are flushed automatically when:
 * - a job is added with `priority: 'immediate'`
 * - the number of queued jobs reaches `maxBufferSize`
 * - `flushIntervalMs` elapses since the first deferred job was enqueued
 *
 * Failed flushes are retried up to `maxRetries` times with a 1-second delay
 * between attempts. After all retries are exhausted the batch is discarded.
 *
 * @typeParam T - The shape of the params object passed to the processor function.
 *
 * @example
 * **Basic usage, batch DB writes**
 * ```ts
 * interface VisitorUpdate {
 *   userId: string;
 *   score: number;
 *   isBot: boolean;
 * }
 *
 * // 1. Define the processor — called once per job when the batch flushes.
 * async function saveVisitor({ userId, score, isBot }: VisitorUpdate) {
 *   await db.query(
 *     'UPDATE visitors SET score = $1, is_bot = $2 WHERE id = $3',
 *     [score, isBot, userId]
 *   );
 * }
 *
 * // 2. Create the queue, wiring in your config values.
 * const visitorQueue = new BatchQueue<VisitorUpdate>(saveVisitor, {
 *   maxBufferSize:  200,   // flush when 200 jobs are pending
 *   flushIntervalMs: 3000, // or after 3s of inactivity
 *   maxRetries: 3,         // retry up to 3× on failure
 *   logger: logger.child({ service: 'visitorQueue' }),
 * });
 *
 * // 3. Enqueue jobs from anywhere. Duplicate ids are silently deduplicated —
 * //    the latest call wins, so stale updates are never written.
 * await visitorQueue.add(`visitor:${userId}`, { userId, score: 0.9, isBot: false });
 * await visitorQueue.add(`visitor:${userId}`, { userId, score: 0.95, isBot: false }); // replaces above
 *
 * // 4. Force an immediate flush for high-priority events (e.g. a confirmed ban).
 * await visitorQueue.add(`visitor:${userId}`, { userId, score: 1, isBot: true }, 'immediate');
 *
 * // 5. Drain on shutdown so no jobs are lost.
 * process.on('SIGTERM', () => visitorQueue.shutdown());
 * ```
 *
 * @example
 * **Multiple queues, one class, different job shapes per use-case**
 * ```ts
 * interface EmailJob   { to: string; subject: string; body: string }
 * interface MetricJob  { name: string; value: number; tags: string[] }
 *
 * const emailQueue = new BatchQueue<EmailJob>(
 *   async ({ to, subject, body }) => mailer.send(to, subject, body),
 *   { maxBufferSize: 50, flushIntervalMs: 5000 }
 * );
 *
 * const metricsQueue = new BatchQueue<MetricJob>(
 *   async ({ name, value, tags }) => statsd.gauge(name, value, tags),
 *   { maxBufferSize: 500, flushIntervalMs: 1000 }
 * );
 * ```
 */
export class BatchQueue<T> {
    private readonly bufferSize: number;
    private readonly flushIntervalMs: number;
    private readonly maxRetries: number;
    private readonly processor: (params: T) => Promise<void>;
    private readonly log: Pick<Console, 'error' | 'info'>;

    private jobs: Map<string, BatchJob<T>> = new Map();
    private timer: NodeJS.Timeout | null = null;
    private isFlushing = false;

    /**
     * @param processor - Called once per job during a flush. Receives the job's `params` object.
     * @param options - Optional tuning parameters, 
     * @see {@link BatchQueueOptions}.
     */
    constructor(
        processor: (params: T) => Promise<void>,
        options: BatchQueueOptions = {}
    ) {
        this.processor = processor;
        this.bufferSize = options.maxBufferSize ?? 100;
        this.flushIntervalMs = options.flushIntervalMs ?? 5000;
        this.maxRetries = options.maxRetries ?? 3;
        this.log = options.logger ?? console;
    }

    /**
     * Adds a job to the queue. If a job with the same `id` already exists it is overwritten.
     *
     * @param id - Unique key for deduplication. Re-adding the same id replaces the existing job.
     * @param params - Data forwarded to the processor when this job is flushed.
     * @param priority - `'immediate'` flushes the entire queue synchronously before returning;
     *                   `'deferred'` relies on the timer or buffer-size trigger. Defaults to `'deferred'`.
     */
    public async add(id: string, params: T, priority: Priority = 'deferred'): Promise<void> {
        this.jobs.set(id, { id, priority, params });

        if (priority === 'immediate' || this.jobs.size >= this.bufferSize) {
            await this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.flushIntervalMs);
        }
    }

    /**
     * Flushes all currently queued jobs by invoking the processor for each one in parallel.
     *
     * - A flush in progress is a no-op (concurrent calls are dropped).
     * - On failure the entire batch is re-queued and retried up to `maxRetries` times.
     * - After the final retry the batch is permanently discarded.
     *
     * @param retryCount - Internal retry counter; do not pass this manually.
     */
    public async flush(retryCount = 0): Promise<void> {
        if (this.isFlushing) return;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.jobs.size === 0) return;

        this.isFlushing = true;
        const currentBatch = Array.from(this.jobs.values());
        this.jobs.clear();

        try {
            await Promise.all(currentBatch.map(job => this.processor(job.params)));
        } catch (err) {
            this.log.error(`Batch flush failed (attempt ${retryCount + 1}):`, err);

            if (retryCount < this.maxRetries) {
                this.isFlushing = false;
                await new Promise(res => setTimeout(res, 1000));
                currentBatch.forEach(j => this.jobs.set(j.id, j));
                return this.flush(retryCount + 1);
            }
            this.log.error('Max retries reached. Discarding batch.');
        } finally {
            this.isFlushing = false;
        }
    }

    /**
     * Gracefully drains the queue by performing a final flush, then returns.
     * Call this before process exit to avoid losing pending jobs.
     */
    public async shutdown(): Promise<void> {
        this.log.info('Shutting down BatchQueue: draining remaining jobs...');
        await this.flush();
    }
}
