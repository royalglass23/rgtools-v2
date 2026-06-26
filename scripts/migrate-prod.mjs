import { spawn } from 'node:child_process'

const prodUrl = process.env.DB_URL_PROD
const isDryRun = process.argv.includes('--dry-run')

if (!prodUrl) {
  console.error('DB_URL_PROD is required. Leave DATABASE_URL on dev and set DB_URL_PROD only for this command.')
  process.exit(1)
}

if (!/^postgres(?:ql)?:\/\//.test(prodUrl)) {
  console.error('DB_URL_PROD must be a PostgreSQL connection string.')
  process.exit(1)
}

if (!prodUrl.includes('-pooler')) {
  console.warn('Warning: DB_URL_PROD does not look like a Neon pooled connection string; expected host usually includes "-pooler".')
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const args = ['db:migrate']

if (isDryRun) {
  console.log(`Would run: ${pnpm} ${args.join(' ')} with DATABASE_URL from DB_URL_PROD`)
  process.exit(0)
}

console.log('Running production DB migration with DATABASE_URL sourced from DB_URL_PROD.')
console.log('DATABASE_URL from .env.local is ignored for this child process.')

const child = spawn(pnpm, args, {
  env: {
    ...process.env,
    DATABASE_URL: prodUrl,
  },
  shell: false,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Production migration stopped by signal ${signal}.`)
    process.exit(1)
  }

  process.exit(code ?? 1)
})
