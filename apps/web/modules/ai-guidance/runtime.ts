export const AI_GUIDANCE_OPENAI_TIMEOUT_MS = 5 * 60 * 1000
export const AI_GUIDANCE_TIMEOUT_MESSAGE = 'AI Guidance took longer than 5 minutes, so it was stopped. Please try again.'
export const AI_GUIDANCE_FAILURE_COOLDOWN_MS = 60_000
export const AI_GUIDANCE_REGENERATION_COOLDOWN_MS = 5 * 60_000

export type AiGuidanceMetadata = {
  model: string
  promptVersion: string
  inputSnapshotVersion: string | null
}

export type AiGuidanceFailureRecord = {
  triggeredByUserId: string
  failureStage: string
  errorType: string
  errorMessage: string
  attemptedAt: Date
  retryAfter: Date
  model: string
  promptVersion: string
  inputSnapshotVersion: string | null
}

export type AiGuidanceCooldown =
  | { kind: 'regeneration'; retryAfter: Date; message: string }
  | { kind: 'retry'; retryAfter: Date; message: string }

export type RunAiGuidanceGenerationResult<TSaved> =
  | { ok: true; saved: TSaved }
  | { ok: false; message: string }

type AiGuidanceGenerationInput<TContext, TOutput, TSaved> = {
  stage: string
  model: string
  promptVersion: string
  inputSnapshotVersion?: string | null
  triggeredByUserId: string
  now: () => Date
  latestSuccessAt?: Date | null
  latestFailureRetryAfter?: Date | null
  formatDateTime?: (date: Date) => string
  buildContext: (input: { generatedAt: Date; metadata: AiGuidanceMetadata }) => Promise<TContext>
  generate: (input: { context: TContext; generatedAt: Date; metadata: AiGuidanceMetadata }) => Promise<unknown>
  validate: (value: unknown, input: { context: TContext; generatedAt: Date; metadata: AiGuidanceMetadata }) => TOutput
  save: (input: { context: TContext; output: TOutput; generatedAt: Date; metadata: AiGuidanceMetadata }) => Promise<TSaved>
  recordFailure: (failure: AiGuidanceFailureRecord, input: { context: TContext | null }) => Promise<void>
  classifyError?: (error: unknown) => string
  safeErrorMessage?: (error: unknown) => string
}

export function getAiGuidanceCooldown(input: {
  latestSuccessAt?: Date | null
  latestFailureRetryAfter?: Date | null
  now: Date
  formatDateTime: (date: Date) => string
}): AiGuidanceCooldown | null {
  if (input.latestSuccessAt) {
    const retryAfter = new Date(input.latestSuccessAt.getTime() + AI_GUIDANCE_REGENERATION_COOLDOWN_MS)
    if (retryAfter > input.now) {
      return {
        kind: 'regeneration',
        retryAfter,
        message: `AI Guidance can be regenerated after ${input.formatDateTime(retryAfter)}.`,
      }
    }
  }

  if (input.latestFailureRetryAfter && input.latestFailureRetryAfter > input.now) {
    return {
      kind: 'retry',
      retryAfter: input.latestFailureRetryAfter,
      message: `AI Guidance can be retried after ${input.formatDateTime(input.latestFailureRetryAfter)}.`,
    }
  }

  return null
}

export async function runAiGuidanceGeneration<TContext, TOutput, TSaved>(
  input: AiGuidanceGenerationInput<TContext, TOutput, TSaved>,
): Promise<RunAiGuidanceGenerationResult<TSaved>> {
  const generatedAt = input.now()
  const metadata: AiGuidanceMetadata = {
    model: input.model,
    promptVersion: input.promptVersion,
    inputSnapshotVersion: input.inputSnapshotVersion ?? null,
  }
  const cooldown = input.formatDateTime
    ? getAiGuidanceCooldown({
        latestSuccessAt: input.latestSuccessAt,
        latestFailureRetryAfter: input.latestFailureRetryAfter,
        now: generatedAt,
        formatDateTime: input.formatDateTime,
      })
    : null

  if (cooldown) return { ok: false, message: cooldown.message }

  let context: TContext | null = null
  try {
    context = await input.buildContext({ generatedAt, metadata })
    const rawOutput = await input.generate({ context, generatedAt, metadata })
    const output = input.validate(rawOutput, { context, generatedAt, metadata })
    const saved = await input.save({ context, output, generatedAt, metadata })
    return { ok: true, saved }
  } catch (error) {
    const failure = buildAiGuidanceFailureRecord({
      stage: input.stage,
      error,
      attemptedAt: generatedAt,
      triggeredByUserId: input.triggeredByUserId,
      model: metadata.model,
      promptVersion: metadata.promptVersion,
      inputSnapshotVersion: metadata.inputSnapshotVersion,
      classifyError: input.classifyError,
      safeErrorMessage: input.safeErrorMessage,
    })
    await input.recordFailure(failure, { context })
    return { ok: false, message: failure.errorMessage }
  }
}

export function buildAiGuidanceFailureRecord(input: {
  stage: string
  error: unknown
  attemptedAt: Date
  triggeredByUserId: string
  model: string
  promptVersion: string
  inputSnapshotVersion?: string | null
  classifyError?: (error: unknown) => string
  safeErrorMessage?: (error: unknown) => string
}): AiGuidanceFailureRecord {
  return {
    triggeredByUserId: input.triggeredByUserId,
    failureStage: input.stage,
    errorType: input.classifyError?.(input.error) ?? classifyAiGuidanceError(input.error),
    errorMessage: input.safeErrorMessage?.(input.error) ?? safeAiGuidanceErrorMessage(input.error),
    attemptedAt: input.attemptedAt,
    retryAfter: new Date(input.attemptedAt.getTime() + AI_GUIDANCE_FAILURE_COOLDOWN_MS),
    model: input.model,
    promptVersion: input.promptVersion,
    inputSnapshotVersion: input.inputSnapshotVersion ?? null,
  }
}

export async function fetchAiGuidanceOpenAi(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  let timeout: ReturnType<typeof setTimeout> | null = null
  const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(AI_GUIDANCE_OPENAI_TIMEOUT_MS)
    : createFallbackTimeoutSignal((value) => {
        timeout = value
      })

  try {
    return await fetch(input, {
      ...init,
      signal: timeoutSignal,
    })
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export function isAiGuidanceTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

export function safeAiGuidanceErrorMessage(error: unknown): string {
  if (isAiGuidanceTimeoutError(error)) return AI_GUIDANCE_TIMEOUT_MESSAGE
  if (error instanceof SyntaxError) return 'AI Guidance response was not valid JSON.'
  if (error instanceof Error && error.message) {
    const httpMatch = error.message.match(/HTTP\s+(\d{3})/)
    if (httpMatch) return `AI provider returned HTTP ${httpMatch[1]}.`
    return error.message.slice(0, 300)
  }
  return 'AI Guidance generation failed.'
}

export function classifyAiGuidanceError(error: unknown): string {
  if (isAiGuidanceTimeoutError(error)) return 'timeout'
  if (error instanceof SyntaxError) return 'malformed_json'
  if (!(error instanceof Error)) return 'generation_error'
  if (error.message.includes('OPENAI_API_KEY')) return 'configuration_error'
  if (error.message.includes('HTTP')) return 'ai_response_error'
  return 'generation_error'
}

function createFallbackTimeoutSignal(setTimer: (value: ReturnType<typeof setTimeout>) => void): AbortSignal {
  const controller = new AbortController()
  setTimer(setTimeout(() => controller.abort(), AI_GUIDANCE_OPENAI_TIMEOUT_MS))
  return controller.signal
}
