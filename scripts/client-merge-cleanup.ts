import { config } from 'dotenv'
config({ path: '.env.local' })

import { runClientMergeCleanup } from '../modules/clients/merge-cleanup'

async function main() {
  const apply = process.argv.includes('--apply')
  const result = await runClientMergeCleanup({ apply })
  console.log(apply
    ? `Applied ${result.appliedGroups} auto-merge group(s).`
    : 'Dry-run complete. Re-run with --apply to merge exact ServiceM8 UUID groups.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
