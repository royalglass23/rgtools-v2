import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

function stripInlineComment(value) {
  let quote = null

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]

    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      quote = quote === char ? null : quote ?? char
    }

    if (char === '#' && quote === null) {
      return value.slice(0, index).trim()
    }
  }

  return value.trim()
}

function parseEnvValue(rawValue) {
  const value = stripInlineComment(rawValue)

  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]

    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }

  return value
}

function readEnvFile(filePath) {
  const contents = readFileSync(filePath, 'utf8')
  const match = contents.match(/^DB_URL_PROD\s*=\s*(.*)$/m)

  return match ? parseEnvValue(match[1]) : undefined
}

function readGitignoredProdUrl() {
  for (const envFile of ['.env.local', '.env']) {
    const filePath = path.resolve(process.cwd(), envFile)

    if (!existsSync(filePath)) {
      continue
    }

    const value = readEnvFile(filePath)

    if (value) {
      return value
    }
  }

  return undefined
}

const prodUrl = process.env.DB_URL_PROD ?? readGitignoredProdUrl()
const isDryRun = process.argv.includes('--dry-run')

if (!prodUrl) {
  console.error('DB_URL_PROD is required. Leave DATABASE_URL on dev and set DB_URL_PROD in your shell, .env.local, or .env only for production migrations.')
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
const migrationCommand = process.platform === 'win32' ? `${pnpm} ${args.join(' ')}` : pnpm
const migrationArgs = process.platform === 'win32' ? [] : args

if (isDryRun) {
  console.log(`Would run: ${pnpm} ${args.join(' ')} with DATABASE_URL from DB_URL_PROD`)
  process.exit(0)
}

console.log('Running production DB migration with DATABASE_URL sourced from DB_URL_PROD.')
console.log('DATABASE_URL from local env files is ignored for this child process.')

const child = spawn(migrationCommand, migrationArgs, {
  env: {
    ...process.env,
    DATABASE_URL: prodUrl,
  },
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Production migration stopped by signal ${signal}.`)
    process.exit(1)
  }

  process.exit(code ?? 1)
})
