import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // Workspace packages ship TypeScript source, so bundle them. Everything from npm stays external,
  // including the database package's own dependencies (pg, Prisma runtime), which rely on CommonJS
  // require and wasm assets that must load from node_modules.
  noExternal: [/^@ghassalny\//],
  external: ['pg', /^@prisma\//],
});
