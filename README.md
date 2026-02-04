# Shared Utilities

A collection of generic TypeScript utilities and types reused across various projects.

## Project Structure

- **`generic/`**: Core utility functions for data manipulation, sanitization, and validation.
- **`eslint/`**: Reusable ESLint configurations for Vue and TypeScript.
- **`types/`**: Shared TypeScript interfaces and unified API response formats.

## Usage

### ESLint Configuration

The library exports strict, pre-configured ESLint setups for both pure TypeScript and Vue projects.

**For Pure TypeScript Projects:**
```javascript
// eslint.config.mjs
import { defineStrictTSConfig } from '@sergo/utils/eslint/strict';

export default defineStrictTSConfig({
  rootDir: import.meta.dirname,
  extraIgnores: ['coverage/**']
});
```

**For Vue + TypeScript Projects:**
```javascript
// eslint.config.mjs
import { defineStrictVueConfig } from '@sergo/utils/eslint/strict/vue';

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

```typescript
import { ensureArray, miniCache } from '@sergo/utils';

const list = ensureArray(someValue);
```
