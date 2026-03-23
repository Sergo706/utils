# Shared Utilities

A collection of generic TypeScript utilities and types.

## Structure

- **`generic/`**: Core utility functions for data manipulation, sanitization, and validation.
- **`eslint/`**: Reusable ESLint configurations for Vue/Next.js and TypeScript.
- **`types/`**: Shared TypeScript interfaces and unified API response formats.
- **`server/`**: Server utilities.

## Usage

### ESLint Configuration

The library exports strict, pre configured ESLint setups for both pure TypeScript, Vue projects and React projects.

**For Pure TypeScript Projects:**
```javascript
// eslint.config.mjs
import { defineStrictTSConfig } from '@riavzon/utils/eslint/strict';

export default defineStrictTSConfig({
  rootDir: import.meta.dirname,
  extraIgnores: ['coverage/**']
});
```

**For Vue + TypeScript Projects:**
```javascript
// eslint.config.mjs
import { defineStrictVueConfig } from '@riavzon/utils/eslint/strict/vue';

export default defineStrictVueConfig({
  rootDir: import.meta.dirname,
  overrides: [
    {
      rules: {
        'vue/multi-word-component-names': 'off'
      }
    }
  ]
});
```

### General Utilities

```ts
import { ensureArray, miniCache, BatchQueue } from '@riavzon/utils';

const list = ensureArray(someValue);
```
### Server only
```ts
import { uploadCsv, run } from '@riavzon/utils/server';

await run('some shell command')
const up = await uploadCsv(csvPath, 'table_name', pool as PgPool, 'pg');
const up = await uploadCsv(csvPath, 'table_name', pool as Pool, 'mysql');
```
Check directly the source code to see available utils, docs available via [ts-docs](https://tsdoc.org/), and a dedicated site is coming soon.
Supports esm and cjs.

---
MIT License