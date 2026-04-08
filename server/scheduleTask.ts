import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);


let isShuttingDown = false;
const activeJobs = new Set<Promise<void>>();

/**
 * Awaits all currently running tasks.
 */
export async function shutdownScheduledTasks(): Promise<void> {
    isShuttingDown = true;
    if (activeJobs.size > 0) {
        console.log(`[Background] Waiting for ${String(activeJobs.size)} active tasks to finish before shutdown...`);
        await Promise.allSettled(Array.from(activeJobs));
        console.log(`[Background] All scheduled tasks completed.`);
    }
}


/**
 * Schedules a recurring background child process.
 *
 * - Uses a recursive setTimeout loop to prevent overlapping executions.
 * - Prepends all commands with `nice -n 19` on Unix.
 * - Each job is tracked in a local set for graceful shutdown.
 * - The child process buffer is capped at `memoryCap` defaults to 10MB.
 * - If shutdownScheduledTasks() is called, no new jobs will be scheduled and the function will wait for all active jobs to finish.
 *
 * @param name Label used in console log messages for this task.
 * @param cmd Absolute or relative path to the executable.
 * @param args Arguments passed to the executable.
 * @param interval Milliseconds to wait after a task completes before running it again.
 * @param memoryCap Optional. Max stdout/stderr buffer in bytes for the child process (default 10MB).
 *
 * @example
 * // Run a cleanup script every 12 hours:
 * import { scheduleTask } from '@riavzon/auth'
 * scheduleTask('my-cleanup', './node_modules/.bin/my-tool', ['--clean'], 1000 * 60 * 60 * 12)
 */
export function scheduleTask(
    name: string,
    cmd: string,
    args: string[],
    interval: number,
    memoryCap: number = 10 * 1024 * 1024
): void {
    if (isShuttingDown) return;
    const isWindows = process.platform === "win32";

    setTimeout(() => {
        if (isShuttingDown) return;

        const runJob = async () => {
            const executable = isWindows ? cmd : "nice";
            const execArgs = isWindows ? args : ["-n", "19", cmd, ...args];

            try {
                await execFileAsync(executable, execArgs, { 
                    maxBuffer: memoryCap
                });
                console.log(`[Background] ${name} completed successfully.`);
            } catch (err) {
                console.error(`[Background] ${name} error:`, err);
            } finally {
                if (!isShuttingDown) {
                    scheduleTask(name, cmd, args, interval);
                }
            }
        };

        const jobPromise = runJob();
        activeJobs.add(jobPromise);
        

       void jobPromise.finally(() => {
            activeJobs.delete(jobPromise);
        });

    }, interval);
}