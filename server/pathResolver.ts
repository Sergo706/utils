import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Recursively walks up the directory tree until it finds a directory containing
 * the given marker file, then returns that directory's absolute path.
 *
 * @param currentDir - Directory to start the search from. Defaults to the
 *   directory of this module.
 * @param marker - Filename whose presence signals the root (`package.json`).
 * @returns Absolute path of the first directory that contains `marker`.
 * @throws {Error} When the filesystem root is reached without finding `marker`.
 *
 * @example
 * // Find the nearest directory that contains a `tsconfig.json`
 * const root = getRoot('/home/user/project/src', 'tsconfig.json');
 */
export function getRoot(currentDir = __moduleDir, marker = 'package.json'): string {
  if (fs.existsSync(path.join(currentDir, marker))) {
    return currentDir;
  }

  const parentDir = path.resolve(currentDir, '..');
  if (parentDir === currentDir) throw new Error(`Could not find root (marker: "${marker}")`);

  return getRoot(parentDir, marker);
}

/**
 * Resolves the absolute path of a data file by searching a prioritized list of
 * directories under the project root.
 *
 * @param fileName - Bare filename to look for (e.g. `"geo.mmdb"`).
 * @param searchDirs - Directories to search, relative to `root`, tried in
 *   order (e.g. `['_data-sources', 'dist/_data-sources']`).
 * @param optionalFiles - Filenames that are allowed to be absent. When
 *   `fileName` is in this list and not found, `""` is returned instead of
 *   throwing.
 * @param root - Project root to resolve `searchDirs` against. Defaults to the
 *   result of {@link getRoot}.
 * @returns Absolute path to the first match found, or `""` if the file is
 *   optional and absent.
 * @throws {Error} When the file cannot be found and is not listed in
 *   `optionalFiles`.
 *
 * @example
 * const dbPath = resolveDataPath('geo.mmdb', ['_data-sources', 'dist/_data-sources']);
 */
export function resolvePath(
  fileName: string,
  searchDirs: string[],
  optionalFiles: string[] = [],
  root = getRoot(),
): string | never {

  for (const dir of searchDirs) {
    const resolved = path.resolve(root, dir, fileName);
    if (fs.existsSync(resolved)) return resolved;
  }

  if (!optionalFiles.includes(fileName)) {
    throw new Error(
      `File "${fileName}" not found in [${searchDirs.join(', ')}]. `
    );
  }

  return '';
}
