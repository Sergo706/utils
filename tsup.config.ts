import { defineConfig, type Options } from 'tsup';

const config: Options = {
  entry: {
    main: './main.ts',
    'eslint/strict': './eslint/strict.ts.config.ts',
    'eslint/strict/vue': './eslint/strict.vue.config.ts',
    'eslint/strict/react': './eslint/strict.react.config.ts'
  },
  format: ['esm'],
  tsconfig: 'tsconfig.json',
  dts: true,
  sourcemap: true,
  clean: true,  
  splitting: true,
  outDir: 'dist',
  external: [
    'zod',
    'pino',
    'eslint',
    'typescript-eslint',
    'eslint-plugin-vue',
    'eslint-config-next'
  ],
  treeshake: true,
};

export default defineConfig(config);