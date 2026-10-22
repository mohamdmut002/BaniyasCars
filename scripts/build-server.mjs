// Bundles the server into dist/server.js for `npm start`. sharp stays external (native module).
import * as esbuild from 'esbuild'
import { cp, mkdir } from 'node:fs/promises'

await esbuild.build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: true,
  external: ['sharp'],
  jsx: 'automatic',
  jsxImportSource: 'hono/jsx',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
})
await mkdir('dist/migrations', { recursive: true })
await cp('src/db/migrations', 'dist/migrations', { recursive: true })
console.log('server built: dist/server.js')
