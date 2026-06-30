export function isServiceM8QuoteStatus(status: string | null | undefined) {
  return (status ?? '').trim().toLowerCase() === 'quote'
}

export function isLeadReadOnlyForLeadIntake(input: {
  servicem8JobUuid: string | null
  servicem8Status: string | null
}) {
  return Boolean(input.servicem8JobUuid) && !isServiceM8QuoteStatus(input.servicem8Status)
}
