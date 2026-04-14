import child, { spawn } from 'node:child_process';
import util from 'node:util';
import type { ExecOptions } from 'node:child_process';

export interface RunResult {
    stdout: string | Buffer;
    stderr: string | Buffer;
}

const execAsync = util.promisify(child.exec);

/**
 * Executes a shell command and returns the output.
 * 
 * @param command - The shell command to execute
 * @param options - Optional node:child_process ExecOptions
 * @returns A promise resolving to the stdout and stderr
 */

export const run = async (command: string, options: ExecOptions = {}): Promise<RunResult> => {
    try {
        const { stdout, stderr } = await execAsync(command, {
            ...options,
            maxBuffer: options.maxBuffer ?? 1024 * 1024 * 10, 
        });

        const result: RunResult = {
            stdout: typeof stdout === 'string' ? stdout.trim() : stdout,
            stderr: typeof stderr === 'string' ? stderr.trim() : stderr,
        };

        console.log(`[run]: ${command}`);
        if (result.stdout) console.log(`stdout ${command}:`, result.stdout);
        if (result.stderr) console.error(`stderr ${command}:`, result.stderr);

        return result;
    } catch (error: unknown) {
        console.error(`Execution failed for command: "${command}"`);
        
        if (typeof error === 'object' && error !== null) {
            const e = error as { stderr?: string; stdout?: string };
            if (e.stderr) console.error('Error Output:', e.stderr);
        }
        
        throw error;
    }
};

/**
 * Spawns a child process to run a shell command, streaming stdout and stderr live to the parent process.
 *
 * @param cmd - The command to execute (e.g., 'npx').
 * @param args - Arguments to pass to the command (default: []).
 * @param options - Optional spawn options. If `detached` is true, the child will be detached from the parent.
 *
 * @returns A promise that resolves when the process exits with code 0, or rejects with an error if the exit code is nonzero or the process fails to start.
 *
 * @example
 *   await spawnRun('npx', ['@riavzon/bot-detector', 'init', '--contact=...']);
 */

export const spawnRun = async (cmd: string, args = [], options: child.SpawnOptionsWithoutStdio = {}) => {

     await new Promise<void>((resolve, reject) => {
        const run = spawn(cmd, args, {
            shell: true,
            cwd: process.cwd(),
            ...options,
        });

        if (options.detached) run.unref();

        console.log(`[run]: ${cmd}`);
        run.stdout.on('data', (d: string) => process.stdout.write(d));
        run.stderr.on('data', (d: string) => process.stderr.write(d));
        run.on('error', (err: Error) => { reject(err); });

        run.on('close', (code: number) => {
            if (code === 0) resolve();
            else reject(new Error(`${cmd} exited with code ${String(code)}`));
        });
    });

    return;
};