import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';

/**
 * Default paths to ignore for standard projects.
 */
export const DEFAULT_IGNORES = [
  '.nuxt/**',
  'node_modules/**',
  'eslint.config.mjs',
  'drizzle.config.ts',
  'vitest.config.ts',
  'nuxt.config.ts',
  'tests/**',
  'scripts/**',
  'coverage/**',
  'docker/healthcheck.js',
  '**/*.{yml,sh,json,txt,age,md}',
];

/**
 * Creates a reusable, strict ESLint configuration for Vue 3 and TypeScript.
 * 
 * @param options - Configuration options.
 * @param options.rootDir - The root directory of the project (required for type-checked rules).
 * @param options.ignores - Optional override for the default ignore list.
 * @param options.extraIgnores - Optional additional paths to ignore.
 * @param options.overrides - Optional array of additional ESLint configuration objects.
 * @returns A consolidated ESLint configuration array.
 */
export function defineStrictVueConfig(options: {
  rootDir: string;
  ignores?: string[];
  extraIgnores?: string[];
  overrides?: any[];
}): any[] {
  const finalIgnores = options.ignores ?? DEFAULT_IGNORES;
  
  return tseslint.config(
    {
      ignores: [
        ...finalIgnores,
        ...(options.extraIgnores ?? [])
      ]
    },
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    ...pluginVue.configs['flat/recommended'],
    {
      files: ['**/*.{ts,vue}'],
      languageOptions: {
        parserOptions: {
          tsconfigRootDir: options.rootDir,
          extraFileExtensions: ['.vue'],
          projectService: true
        }
      }
    },
    {
      files: ['**/*.vue'],
      languageOptions: {
        parserOptions: { parser: tseslint.parser }
      },
      rules: {
        '@typescript-eslint/unified-signatures': 'off'
      }
    },
    {
      name: 'project-rules',
      files: ['**/*.{js,ts,vue}'],
      rules: {
        'array-bracket-spacing': ['error', 'never'],
        'semi': 'warn',
        'no-undef': 'off',
        '@typescript-eslint/unified-signatures': 'error',
        '@typescript-eslint/no-deprecated': 'off',
      }
    },
    {
      files: ['**/*.{js,cjs,mjs}'],
      rules: { 'no-undef': 'error' }
    },
    ...(options.overrides ?? [])
  );
}