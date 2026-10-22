// Builds public/assets: Tailwind CSS (via the tailwindcss compile API) and the small client scripts (esbuild).
// Output files are content-hashed and listed in public/assets/manifest.json for long-term caching.
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { compile } from 'tailwindcss'
import * as esbuild from 'esbuild'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const out = path.join(root, 'public/assets')
const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10)

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])))
  return files.flat()
}

async function buildCss() {
  const twDir = path.dirname(require.resolve('tailwindcss/package.json'))
  const input = await readFile(path.join(root, 'src/styles/app.css'), 'utf8')
  const compiler = await compile(input, {
    base: path.join(root, 'src/styles'),
    async loadStylesheet(id, base) {
      const map = { tailwindcss: 'index.css', 'tailwindcss/theme': 'theme.css', 'tailwindcss/preflight': 'preflight.css', 'tailwindcss/utilities': 'utilities.css' }
      const file = map[id] ? path.join(twDir, map[id]) : path.resolve(base, id)
      return { path: file, base: path.dirname(file), content: await readFile(file, 'utf8') }
    },
  })
  const sources = (await walk(path.join(root, 'src'))).filter((f) => /\.(tsx?|ts)$/.test(f))
  const candidates = new Set()
  for (const f of sources) {
    const text = await readFile(f, 'utf8')
    for (const m of text.matchAll(/[^\s"'`<>{}]+/g)) candidates.add(m[0])
  }
  const css = compiler.build([...candidates])
  const min = await esbuild.transform(css, { loader: 'css', minify: true, target: ['chrome105', 'safari15', 'firefox110'] })
  const name = `app.${hash(min.code)}.css`
  await writeFile(path.join(out, name), min.code)
  return name
}

async function buildJs(entry) {
  const result = await esbuild.build({
    entryPoints: [path.join(root, `src/client/${entry}.ts`)],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['chrome105', 'safari15', 'firefox110'],
    write: false,
    sourcemap: false,
  })
  const code = result.outputFiles[0].contents
  const name = `${entry}.${hash(code)}.js`
  await writeFile(path.join(out, name), code)
  return name
}

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
const manifest = { css: await buildCss(), main: await buildJs('main'), admin: await buildJs('admin') }
await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log('assets built', manifest)
