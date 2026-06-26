import { config } from 'dotenv'
config({ path: '.env.local' })

import { runQuoteClientLinkBackfill } from '../modules/quote-tracker/client-link-backfill'

runQuoteClientLinkBackfill().catch((error) => {
  console.error(error)
  process.exit(1)
})
