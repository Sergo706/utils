import tseslint from 'typescript-eslint';

export const DEFAULT_TS_IGNORES = [
  'node_modules/**',
  'dist/**',
  'build/**',
  'eslint.config.mjs',
  'tsconfig.json',
  'tests/**',
  'scripts/**',
  'coverage/**',
  '**/*.{yml,sh,json,txt,md}',
];

/**
 * Creates a reusable, strict ESLint configuration for TypeScript-only projects.
 * 
 * Includes:
 * - Strict type-checked rules.
 * - Stylistic rules.
 * - Custom project formatting and safety rules.
 *
 * @param options - Configuration options.
 * @param options.rootDir - The root directory of the project (required for type-checked rules).
 * @param options.ignores - Optional override for the default ignore list.
 * @param options.extraIgnores - Optional additional paths to ignore.
 * @param options.overrides - Optional array of additional ESLint configuration objects.
 * @returns A consolidated ESLint configuration array.
 */
export function defineStrictTSConfig(options: {
  rootDir: string;
  ignores?: string[];
  extraIgnores?: string[];
  overrides?: any[];
}): any[] {
  const finalIgnores = options.ignores ?? DEFAULT_TS_IGNORES;
  
  return tseslint.config(
    {
      ignores: [
        ...finalIgnores,
        ...(options.extraIgnores ?? [])
      ]
    },
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      files: ['**/*.ts'],
      languageOptions: {
        parserOptions: {
          tsconfigRootDir: options.rootDir,
          projectService: true
        }
      }
    },
    {
      name: 'project-rules',
      files: ['**/*.{js,ts}'],
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
