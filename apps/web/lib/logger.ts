import { db } from '@/lib/db'
import { errorLog } from '@rgtools/db/schema'
import { randomUUID } from 'crypto'

type LogLevel = 'error' | 'warn' | 'info'

interface LogErrorOptions {
  level?: LogLevel
  userId?: string | null
  requestId?: string | null
  metadata?: Record<string, unknown>
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? null,
      name: error.name,
    }
  }

  return {
    message: String(error),
    stack: null,
    name: typeof error,
  }
}

function safeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return null

  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !/password|secret|token/i.test(key)),
  )
}

export async function logError(
  source: string,
  error: unknown,
  options: LogErrorOptions = {},
): Promise<string> {
  const id = randomUUID()
  const normalized = normalizeError(error)
  const metadata = {
    errorId: id,
    errorName: normalized.name,
    ...safeMetadata(options.metadata),
  }

  const payload = {
    id,
    level: options.level ?? 'error',
    source,
    message: normalized.message,
    stack: normalized.stack,
    userId: options.userId ?? null,
    requestId: options.requestId ?? null,
    metadata,
  }

  console.error(JSON.stringify(payload))

  try {
    await db.insert(errorLog).values(payload)
  } catch (logWriteError) {
    console.error(JSON.stringify({
      id: randomUUID(),
      level: 'error',
      source: 'logger.write',
      message: logWriteError instanceof Error ? logWriteError.message : String(logWriteError),
      stack: logWriteError instanceof Error ? logWriteError.stack : null,
      metadata: { originalErrorId: id, originalSource: source },
    }))
  }

  return id
}
