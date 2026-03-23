import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);

import {defineStrictTSConfig} from './eslint/strict.ts.config.js'

export default defineStrictTSConfig({
    rootDir: import.meta.dirname,
    extraIgnores: ['eslint/**']
});