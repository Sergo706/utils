import { defineConfig, type Options } from 'tsup';

const config: Options = {
  entry: {
    main: './main.ts',
    'eslint/strict': './eslint/strict.ts.config.ts',
    'eslint/strict/vue': './eslint/strict.vue.config.ts'
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
    'eslint-plugin-vue'
  ],
  treeshake: true,
};

export default defineConfig(config);