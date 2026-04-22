import fs from 'node:fs/promises';
import path from 'node:path';



/**
 * Determines the presence and accessibility of a filesystem path by attempting to reach it 
 * via the access API. This function returns a simple boolean to indicate 
 * whether the path is reachable by the current process, effectively swallowing 
 * any access-related errors into a false result.
 * * @param path - The absolute or relative filesystem path to verify.
 * @returns A promise that resolves to true if the path is accessible, or false otherwise.
 */
export async function exists(path: string) {
    try { 
       await fs.access(path); 
       return true; 
    } catch { 
        return false; 
    }
}


/**
 * Executes a safe file replacement by using an atomic swap strategy to preserve 
 * data integrity. The process begins by creating a timestamped backup of the target file 
 * and staging the new content in a unique temporary location within the same directory. 
 * Once staged, it performs an atomic `rename` to finalize the replacement. If the operation 
 * succeeds, both the source and the backup are purged; if any step fails, the function 
 * attempts to restore the original file from the backup before propagating the error.
 * * @param existentFile - The path to the file for replacement.
 * @param newFile - The source path providing the updated content.
 * @throws An error if the swap fails or if the rollback procedure cannot be completed.
 */
export async function replaceFile(existentFile: string, newFile: string) {
    const src = path.resolve(newFile);
    const dst = path.resolve(existentFile);
    const dstDir = path.dirname(dst);
    
    if (!(await exists(dstDir))) {
        await fs.mkdir(dstDir, { recursive: true });
    }

    const tmpDst = dst + `.tmp-${Date.now().toString()}-${Math.random().toString(36).slice(2, 6)}`;
    const backup = `${dst}.bak.${Date.now().toString()}`;

    if (await exists(dst)) {
        await fs.cp(dst, backup);
    }

    try {
        await fs.copyFile(src, tmpDst); 
        await fs.rename(tmpDst, dst);
        await fs.rm(src, { recursive: true, force: true });

        if (await exists(backup)) {
            await fs.rm(backup, { recursive: true, force: true });
        }
        console.log(`Successfully replaced ${dst}`);
    } catch (err) {
         if (await exists(backup)) {
             await fs.copyFile(backup, dst);
             await fs.rm(backup, { force: true });
             console.log(`Failed to replace. Original file restored.`);
         } else {
            console.log(`File ${dst} failed to be replaced.`, err);
            if (await exists(tmpDst)) {
                await fs.rm(tmpDst, { force: true });
            }
        }
        throw err;
    }
}     
 
/**
 * Synchronizes directory content by recursively traversing the source path and applying 
 * atomic updates to the destination. It ensures that the target's internal structure 
 * mirrors the source by creating nested directories as they are encountered. 
 * Replacement happens on a per-file basis; if an individual file swap fail, 
 * that specific file is rolled back and the entire process halts immediately to 
 * prevent inconsistent states across the directory tree.
 *  @param existentDir - The target directory whose contents will be updated or created.
 * @param newDir - The source directory containing the new versions of the files and folders.
 * @throws An error if any single file replacement fails or if directory traversal is interrupted.
 */
export async function replaceDirContent(existentDir: string, newDir: string) {

     if (!(await exists(existentDir))) {
        await fs.mkdir(existentDir, { recursive: true });
     }

     if (!(await exists(newDir))) {
         console.warn(`Source directory ${newDir} does not exist. Skipping.`);
         return;
     }

     try {
        const files = await fs.readdir(newDir, { withFileTypes: true });

        for (const file of files) {
            const src = path.join(newDir, file.name);
            const dst = path.join(existentDir, file.name);
            
            try {
                if (file.isDirectory()) {
                    await replaceDirContent(dst, src);
                } else {
                    await replaceFile(dst, src); 
                }
            } catch (err) {
                throw err;
            }
        }

     } catch (err) {
          console.log(`Error replacing old files in ${existentDir}`, err);
          throw err;
      }
}