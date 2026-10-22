// Development: build the site, serve it, and rebuild when files in src/ or public/ change.
//   npm run dev  →  http://localhost:4173/
import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from './serve.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')

let running = false
let again = false
function rebuild() {
  if (running) {
    again = true
    return
  }
  running = true
  // A fresh process each time, so edited data and pages are always re-read.
  const child = spawn(process.execPath, [tsx, path.join(root, 'scripts', 'build.ts')], { stdio: 'inherit', cwd: root })
  child.on('exit', () => {
    running = false
    if (again) {
      again = false
      rebuild()
    }
  })
  return child
}

const first = rebuild()
first.on('exit', (code) => {
  if (code !== 0) console.error('First build failed; fix the error above and save again.')
  startServer()
  let timer
  for (const dir of ['src', 'public']) {
    watch(path.join(root, dir), { recursive: true }, () => {
      clearTimeout(timer)
      timer = setTimeout(rebuild, 150)
    })
  }
  console.log('Watching src/ and public/ for changes…')
})
