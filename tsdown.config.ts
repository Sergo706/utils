import { defineConfig } from 'tsdown';

export default defineConfig(
    {
    entry: {
        main: './main.ts',
        'eslint/strict': './eslint/strict.ts.config.ts',
        'eslint/strict/vue': './eslint/strict.vue.config.ts',
        'eslint/strict/react': './eslint/strict.react.config.ts',
        server: './server/main.ts',
    },
    target: ['node18', "es2020"],
    format: ['esm', 'cjs'],
    clean: true,
    treeshake: true,
    sourcemap: true,
    minify: true,
    tsconfig: 'tsconfig.json',
    dts: true,
    failOnWarn: true,
    publint: {
      level: 'error',
      enabled: 'ci-only',
      strict: true,
    },
    attw: {
      level: 'error',
      enabled: 'ci-only'
    },
    deps: {
        neverBundle: [
            'zod',
            'pino',
            'eslint',
            'mysql2',
            'typescript-eslint',
            /^next/,
            /^eslint-plugin-/, 
            /^eslint-config-/,
            'eslint-plugin-vue',
            'eslint-config-next'
        ]
    }
}
);