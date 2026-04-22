import fs from 'node:fs/promises';
import path from 'node:path';



/**
 * Check if a filesystem path exists and is accessible.
 *
 * @param path - Filesystem path to check.
 * @returns `true` when the path exists and is accessible, otherwise `false`.
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
 * Replaces a file with a new one using an atomic-swap strategy.
 * * @remarks
 * This function ensures data integrity by:
 * 1. Creating a backup of the existing file.
 * 2. Staging the new file in a temporary location.
 * 3. Performing an atomic rename to replace the target.
 * 4. Rolling back to the backup if any step fails.
 * @param existentFile - The path to the file to be replaced.
 * @param newFile - The path to the source file providing the new content.
 * @throws An error if the replacement or rollback fails.
 */
export async function replaceFile(existentFile: string, newFile: string) {
    const src = path.resolve(newFile);
    const dst = path.resolve(existentFile);
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
        };
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
 * Iterates through a source directory and replaces matching files in a destination directory.
 * * @remarks
 * This function processes files one-by-one. If a single file replacement fails, 
 * the function will attempt a rollback for that specific file and then throw an error, 
 * halting further replacements.
 * @param existentDir - The directory containing files to be updated.
 * @param newDir - The directory containing the new versions of the files.
 * @throws An error if any individual file replacement fails.
 */
export async function replaceDirContent(existentDir: string, newDir: string) {

     if (!await exists(newDir)) {
        await fs.mkdir(newDir, { recursive: true });
     }

     try {
        const files = await fs.readdir(newDir);

        for (const file of files) {
            const src = path.join(newDir, file);
            const dst = path.join(existentDir, file);
            try {
                await replaceFile(dst, src);
            } catch (err) {
                throw err;
            }
        }

     } catch (err) {
          console.log(`Error replacing old files`, err);
          throw err;
      }
}