import { randomBytes } from 'node:crypto'

// Base62 short codes used as the public identifier in quote links
// (e.g. quotes.royalglass.co.nz/q/a7Kp9Qz). Short, URL-safe, no lookalike
// stripping — collisions are handled by a unique constraint + retry at the
// DB layer (Stage 2).
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function generateShortCode(length = 7): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

const SHORT_CODE_RE = /^[0-9A-Za-z]{4,16}$/
export function isValidShortCode(code: string): boolean {
  return SHORT_CODE_RE.test(code)
}
