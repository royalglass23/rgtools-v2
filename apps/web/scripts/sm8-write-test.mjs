// Smoke test: can SERVICEM8_API_KEY_FULL write the Leads Quality custom field
// on the test job R260210? Run:
//   node --env-file=.env.local scripts/sm8-write-test.mjs
const BASE = 'https://api.servicem8.com/api_1.0'
const UUID = '830f6f91-ec52-4ce4-a80f-24383061504b' // test job R260210
const FIELD = 'customfield_leads_quality_'
const KEY = process.env.SERVICEM8_API_KEY_FULL
const h = { 'X-API-Key': KEY, Accept: 'application/json', 'Content-Type': 'application/json' }

if (!KEY) {
  console.error('SERVICEM8_API_KEY_FULL is not set'); process.exit(1)
}
console.log('key prefix:', KEY.slice(0, 6))

const before = await (await fetch(`${BASE}/job/${UUID}.json`, { headers: h })).json()
console.log('before:', JSON.stringify(before[FIELD]))

const w = await fetch(`${BASE}/job/${UUID}.json`, {
  method: 'POST',
  headers: h,
  body: JSON.stringify({ [FIELD]: 'A' }),
})
console.log('WRITE:', w.status, (await w.text()).slice(0, 200))

const after = await (await fetch(`${BASE}/job/${UUID}.json`, { headers: h })).json()
console.log('READ BACK:', JSON.stringify(after[FIELD]), '| stuck:', after[FIELD] === 'A')

// reset to empty so the test job is left clean
await fetch(`${BASE}/job/${UUID}.json`, { method: 'POST', headers: h, body: JSON.stringify({ [FIELD]: '' }) })
const reset = await (await fetch(`${BASE}/job/${UUID}.json`, { headers: h })).json()
console.log('after reset:', JSON.stringify(reset[FIELD]))
