import type { Pool, ResultSetHeader } from "mysql2/promise";
import path from "node:path";
import  fs  from "node:fs";
import type { Results } from "../../types/StandardResponse.js";
import { execSync } from "node:child_process";


/**
 * Bulk loads data from a CSV file directly into a MySQL table using `LOAD DATA LOCAL INFILE`.
 * * This function handles file path resolution, ensures the target table uses the InnoDB engine 
 * with `utf8mb4` encoding, and automatically cleans up temporary files if a row limit is applied.
 * * **Warning**: The MySQL connection pool passed to this function MUST be configured with 
 * `flags: ['+LOCAL_FILES']` to allow local file reading, or the query will hang indefinitely.
 * * @param paths - The relative or absolute file path to the CSV data. Resolves from the current working directory.
 * @param tableName - The exact name of the MySQL table where the data will be inserted.
 * @param pool - A configured `mysql2/promise` connection pool.
 * @param limit - (Optional) The maximum number of data rows to insert. 
 * *Note: This relies on the Unix `head` command and will fail on native Windows environments without WSL/Bash.*
 * @param timeoutMs - (Optional) The maximum time in milliseconds the database query or shell command is allowed to run before aborting.
 * * @returns A standardized `Results` object containing the success status, timestamp, and either the success data or error reason.
 * * @example
 * ```typescript
 * // Abort if the upload takes longer than 30 seconds (30000ms)
 * const result = await uploadMetaData('./data/movies.csv', 'movies', myDbPool, 1000, 30000);
 * if (!result.ok) console.error(result.reason);
 * ```
 */
export async function uploadCsv(paths: string, tableName: string, pool: Pool, limit?: number, timeoutMs?: number): Promise<Results> {
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
      tempFilePath = `${filePath}.tmp`;
      try {
        execSync(`head -n ${String(limit + 1)} "${filePath}" > "${tempFilePath}"`, {
            timeout: timeoutMs,
        });
        loadPath = tempFilePath;
      } catch (e) {
        console.error("Error creating temp file with head:", e);
        throw e;
      }
    }

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
      const [res] = await connection.query<ResultSetHeader>({
        sql: stm,
        timeout: timeoutMs
      });

      if (!res.affectedRows) {
        const [warns] = await connection.query("SHOW WARNINGS LIMIT 10");
        throw new Error(`0 rows loaded from ${loadPath}. Warnings: ${JSON.stringify(warns)}`);
      }
    } finally {
      connection.release();
    }

    return {
      ok: true,
      date: new Date().toISOString(),
      data: 'success'
    };
  } catch (err) {
    console.error(err);
    const isTimeout = err instanceof Error && 'code' in err && err.code === 'PROTOCOL_SEQUENCE_TIMEOUT';
    return {
      ok: false,
      date: new Date().toISOString(),
      reason: isTimeout 
        ? `Operation timed out after ${timeoutMs}ms` 
        : err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch { }
    }
  }
}