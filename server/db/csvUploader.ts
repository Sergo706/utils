import type { Pool as MysqlPool, ResultSetHeader } from "mysql2/promise";
import type { Pool as PgPool } from "pg";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import readline from "node:readline";
import type { Results } from "../../types/StandardResponse.js";

/**
 * Bulk loads data from a CSV file directly into a MySQL or PostgreSQL table.
 * * For MySQL, uses `LOAD DATA LOCAL INFILE`. The pool MUST be configured with
 * `flags: ['+LOCAL_FILES']` or the query will hang indefinitely.
 * * For PostgreSQL, uses `COPY tableName FROM '/path'` (requires `pg_read_server_files` privilege).
 * * File row limiting is handled in Node.js (platform-agnostic — no shell `head` command).
 * * @param paths - Relative or absolute path to the CSV file. Resolves from `process.cwd()`.
 * @param tableName - The exact name of the target database table.
 * @param pool - A configured `mysql2/promise` or `pg` connection pool.
 * @param dialect - The database dialect: `'mysql'` or `'pg'`.
 * @param limit - (Optional) Maximum number of data rows to insert (excludes the header row).
 * @param timeoutMs - (Optional) Abort the upload after this many milliseconds.
 * @returns A standardized `Results` object with success status, timestamp, and data or error reason.
 * * @example
 * ```typescript
 * const result = await uploadCsv('./data/movies.csv', 'movies', myPool, 'pg', 1000);
 * if (!result.ok) console.error(result.reason);
 * ```
 */
export async function uploadCsv(
  paths: string,
  tableName: string,
  pool: MysqlPool | PgPool,
  dialect: "mysql" | "pg",
  limit?: number,
  timeoutMs?: number,
): Promise<Results> {
  let tempFilePath: string | null = null;
  try {
    const filePath = path.resolve(process.cwd(), paths);

    if (!fs.existsSync(filePath)) {
      console.error(`FILE NOT FOUND at the expected location. ${filePath}`);
      return {
        ok: false,
        date: new Date().toISOString(),
        reason: `File not found at ${filePath}`,
      };
    }

    let loadPath = filePath;
    if (limit) {
      tempFilePath = path.join(os.tmpdir(), `${path.basename(filePath)}.tmp`);
      const maxLines = limit + 1;
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      const lines: string[] = [];

      for await (const line of rl) {
        lines.push(line);
        if (lines.length >= maxLines) break;
      }

      rl.close();
      fileStream.destroy();
      fs.writeFileSync(tempFilePath, lines.join("\n"));
      loadPath = tempFilePath;
    }

    const upload = dialect === "mysql"
      ? uploadMysql(pool as MysqlPool, tableName, loadPath, timeoutMs)
      : uploadPg(pool as PgPool, tableName, loadPath, timeoutMs);

    await (timeoutMs ? Promise.race([upload, rejectAfter(timeoutMs)]) : upload);

    return {
      ok: true,
      date: new Date().toISOString(),
      data: "success",
    };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      date: new Date().toISOString(),
      reason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch { }
    }
  }
}

async function uploadMysql(pool: MysqlPool, tableName: string, loadPath: string, timeoutMs?: number): Promise<void> {
  const alterStm = `
    ALTER TABLE ${tableName}
      ENGINE = InnoDB,
      DEFAULT CHARACTER SET = utf8mb4,
      COLLATE = utf8mb4_0900_ai_ci;
  `;

  const stm = `
    LOAD DATA LOCAL INFILE '${loadPath}'
    REPLACE INTO TABLE ${tableName}
    FIELDS TERMINATED BY ','
    OPTIONALLY ENCLOSED BY '"'
    ESCAPED BY '"'
    LINES TERMINATED BY '\\n'
    IGNORE 1 LINES;
  `;

  await pool.execute({ sql: alterStm, timeout: timeoutMs });
  const connection = await pool.getConnection();
  try {
    await connection.query("SET SESSION sql_mode = '';");
    const [res] = await connection.query<ResultSetHeader>({ sql: stm, timeout: timeoutMs });

    if (!res.affectedRows) {
      const [warns] = await connection.query("SHOW WARNINGS LIMIT 10");
      throw new Error(`0 rows loaded from ${loadPath}. Warnings: ${JSON.stringify(warns)}`);
    }
  } finally {
    connection.release();
  }
}

function rejectAfter(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
  );
}

async function uploadPg(pool: PgPool, tableName: string, loadPath: string, timeoutMs?: number): Promise<void> {
  const client = await pool.connect();
  try {
    if (timeoutMs) await client.query(`SET statement_timeout = ${timeoutMs}`);
    await client.query(`COPY ${tableName} FROM '${loadPath}' WITH (FORMAT csv, HEADER true)`);
  } finally {
    client.release();
  }
}
