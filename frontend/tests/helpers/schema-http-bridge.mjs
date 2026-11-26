import { readFileSync } from 'node:fs'
import { load } from './modules.mjs'

// Receives the actual Nest/Express wire body, not a reconstructed fixture.
const { status, text } = JSON.parse(readFileSync(0, 'utf8'))
const { apiRequest, ApiError } = await load('shared/api/client')
const { errorMessage } = await load('shared/composables/useRemote')
globalThis.fetch = async () => new Response(text, {
  status, headers: { 'Content-Type': 'application/json' },
})
try {
  await apiRequest('/fixture')
  throw new Error('Expected HTTP error')
} catch (error) {
  if (!(error instanceof ApiError)) throw error
  process.stdout.write(JSON.stringify({
    status: error.status, code: error.code, operation: error.operation,
    diagnostic: error.diagnostic, message: error.message, presented: errorMessage(error),
  }))
}
