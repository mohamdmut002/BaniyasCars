// Builds the Cloudflare Pages output in pages-dist/:
//   static files (CSS, JS, fonts, images) + _worker.js (the whole app as a Pages Function, "advanced mode")
//   + _routes.json (static paths skip the Function) + _headers (long cache for hashed files).
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import * as esbuild from 'esbuild'

const out = 'pages-dist'
execFileSync(process.execPath, ['scripts/build-assets.mjs'], { stdio: 'inherit' })
const manifest = JSON.parse(await readFile('public/assets/manifest.json', 'utf8'))

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
await cp('public', out, { recursive: true })

await esbuild.build({
  entryPoints: ['src/worker.ts'],
  outfile: `${out}/_worker.js`,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  // Pick the Workers builds of dependencies (postgres.js ships one under the "workerd" condition).
  conditions: ['workerd', 'worker', 'browser', 'import'],
  mainFields: ['module', 'main'],
  external: ['node:*', 'cloudflare:*', 'sharp', '@hono/node-server', '@hono/node-server/*'],
  jsx: 'automatic',
  jsxImportSource: 'hono/jsx',
  define: { __ASSET_MANIFEST__: JSON.stringify(manifest) },
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
})

await writeFile(
  `${out}/_routes.json`,
  JSON.stringify({ version: 1, include: ['/*'], exclude: ['/assets/*', '/fonts/*', '/favicon.svg', '/og-default.png'] }, null, 2),
)
await writeFile(
  `${out}/_headers`,
  ['/assets/*', '  Cache-Control: public, max-age=31536000, immutable', '/fonts/*', '  Cache-Control: public, max-age=31536000, immutable', ''].join('\n'),
)
const { size } = await import('node:fs').then((fs) => fs.statSync(`${out}/_worker.js`))
console.log(`Pages build ready in ${out}/ (_worker.js ${(size / 1024).toFixed(0)} KB)`)
