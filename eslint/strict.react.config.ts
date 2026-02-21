import tseslint from 'typescript-eslint';
import nextVitals from 'eslint-config-next/core-web-vitals';

export const DEFAULT_REACT_IGNORES = [
  'node_modules/**',
  'dist/**',
  'build/**',
  'tsconfig.json',
  'tests/**',
  'scripts/**',
  'coverage/**',
  '**/*.{yml,sh,json,txt,md}',
  '.next/**',
  'out/**',
  'next-env.d.ts',
  '*.config.js',
  '*.config.mjs',
  '*.config.ts',
];

/**
 * Creates a reusable, strict ESLint configuration for React/Next.js and TypeScript.
 * 
 * Includes:
 * - Strict type-checked rules.
 * - Stylistic rules.
 * - Next.js core web vitals rules.
 * - Custom project formatting and safety rules.
 *
 * @param options - Configuration options.
 * @param options.rootDir - The root directory of the project (required for type-checked rules).
 * @param options.ignores - Optional override for the default ignore list.
 * @param options.extraIgnores - Optional additional paths to ignore.
 * @param options.overrides - Optional array of additional ESLint configuration objects.
 * @returns A consolidated ESLint configuration array.
 */
export function defineStrictReactConfig(options: {
  rootDir: string;
  ignores?: string[];
  extraIgnores?: string[];
  overrides?: any[];
}): any[] {
  const finalIgnores = options.ignores ?? DEFAULT_REACT_IGNORES;

  return tseslint.config(
    {
      ignores: [
        ...finalIgnores,
        ...(options.extraIgnores ?? [])
      ]
    },
    ...nextVitals,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      files: ['**/*.ts', '**/*.tsx'],
      languageOptions: {
        parserOptions: {
          tsconfigRootDir: options.rootDir,
          projectService: true,
        }
      }
    },
    {
      name: 'project-rules',
      files: ['**/*.{js,ts,tsx}'],
      rules: {
        'array-bracket-spacing': ['error', 'never'],
        'semi': 'warn',
        'no-undef': 'off',
        '@typescript-eslint/unified-signatures': 'error',
        '@typescript-eslint/no-deprecated': 'off',
      }
    },
    {
    name: 'file-level-use-server',
    files: ['src/**/*.ts', 'src/**/*.tsx'], 
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Program > ExpressionStatement[expression.value='use server']",
          message: "File-level 'use server' is banned. Place the directive inside individual exported functions to prevent accidentally exposing private helpers."
        }
      ]
    }
  },
    {
      files: ['**/*.{js,cjs,mjs}'],
      rules: { 'no-undef': 'error' }
    },
    ...(options.overrides ?? [])
  );
}