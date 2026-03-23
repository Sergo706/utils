import { defineConfig, type UserConfig } from 'tsdown';


const shared: UserConfig = {
    target: ['node18', "es2020"],
    format: ['esm', 'cjs'],
    clean: true,
    sourcemap: true,
    tsconfig: 'tsconfig.json',
    dts: true,
    failOnWarn: true,
    treeshake: true,
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
            'typescript-eslint',
            /^next/,
            /^eslint-plugin-/, 
            /^eslint-config-/,
            /^mysql2/,
             /^pg/,
            'eslint-plugin-vue',
            'eslint-config-next'
        ]
    }
};

export default defineConfig([
    {
        entry: { 
            'eslint/strict': './eslint/strict.ts.config.ts',
            'eslint/strict/vue': './eslint/strict.vue.config.ts',
            'eslint/strict/react': './eslint/strict.react.config.ts',
            server: './server/main.ts' 
        },
        ...shared,
        minify: false,
    },
    {
        ...shared,
        entry: './main.ts',
        minify: true,
    }
]);