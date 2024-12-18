import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['./src/index.ts'],
  noExternal: ['relgen-core'],
  minify: true,
});