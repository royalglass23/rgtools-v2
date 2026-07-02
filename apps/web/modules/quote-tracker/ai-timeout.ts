export const AI_GUIDANCE_OPENAI_TIMEOUT_MS = 5 * 60 * 1000
export const AI_GUIDANCE_TIMEOUT_MESSAGE = 'AI Guidance took longer than 5 minutes, so it was stopped. Please try again.'

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

function createFallbackTimeoutSignal(setTimer: (value: ReturnType<typeof setTimeout>) => void): AbortSignal {
  const controller = new AbortController()
  setTimer(setTimeout(() => controller.abort(), AI_GUIDANCE_OPENAI_TIMEOUT_MS))
  return controller.signal
}
