/**
 * Creates (or resets) a dashboard user.
 *   npm run admin:create -- --email owner@example.com --name "Owner" --role owner
 * The password is read from ADMIN_PASSWORD, or asked for interactively so it never lands in shell history.
 */
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { sql } from '../src/db/client.js'
import { migrate } from '../src/db/migrate.js'
import { createAdmin, passwordProblem } from '../src/lib/auth.js'

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const email = arg('email')
  const name = arg('name') ?? 'Admin'
  const role = arg('role') === 'staff' ? 'staff' : 'owner'
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Pass a valid --email')
  let password = process.env.ADMIN_PASSWORD
  if (!password) {
    const rl = createInterface({ input: stdin, output: stdout })
    password = await rl.question('Password (10+ characters, letters and digits): ')
    rl.close()
  }
  const problem = passwordProblem(password)
  if (problem) throw new Error(problem)
  await migrate()
  await createAdmin(email, name, password, role)
  console.log(`Admin ready: ${email} (${role})`)
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e)
    await sql.end()
    process.exit(1)
  })
