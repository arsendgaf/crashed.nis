import { act, useState } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import useSWR, { SWRConfig, useSWRConfig } from 'swr'
import { afterEach, expect, test } from 'vitest'

// Test-only file: no module exports, and the probe/purge components below
// are local to a helper closure, so the fast-refresh export rule (which
// scans whole files) does not apply here.
// oxlint-disable react/only-export-components

// The cross-session cache reset lives in the login handler (auth.tsx): pages
// long-dedupe their fetches, and a purge with `revalidate: false` leaves
// SWR's internal request bookkeeping behind, so the next mount for a purged
// key silently skips its initial fetch. These specs pin the revalidate-pass
// purge the login uses and the hazard it guards against. The probe subset
// lives inside a helper closure so the file exports no components (the
// fast-refresh lint applies to top-level ones).

// Mirrors the journal page's throttle options (long dedupe window, no stale
// or focus revalidation).
const THROTTLE_OPTIONS = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  revalidateOnReconnect: false,
  dedupingInterval: 5 * 60 * 1000,
} as const

let fetchCalls = 0

afterEach(cleanup)

// Runs the logout → auth purge → re-login cycle in one provider lifecycle:
// 1. a throttled hook fetches with data (`journal`-probe),
// 2. auth mounts with no data hooks; the purge runs there (`purge` button),
// 3. the same key mounts again (still inside SWR's dedupe window).
async function runCrossSessionCycle(purgeRevalidate: boolean) {
  let recorded = 0

  function Probe() {
    const { data } = useSWR(
      'journal',
      async () => {
        recorded += 1
        fetchCalls += 1
        return ['value']
      },
      THROTTLE_OPTIONS,
    )
    return data === undefined ? <div>loading</div> : <div>loaded:{data[0]}</div>
  }

  function PurgeButton() {
    const { mutate } = useSWRConfig()
    return (
      <button
        type="button"
        onClick={() => void mutate(() => true, undefined, { revalidate: purgeRevalidate })}
      >
        purge
      </button>
    )
  }

  function App() {
    const [probe, setProbe] = useState(true)
    return (
      <>
        {probe && <Probe />}
        {!probe && <PurgeButton />}
        <button type="button" onClick={() => setProbe(false)}>
          to-auth
        </button>
        <button type="button" onClick={() => setProbe(true)}>
          to-session2
        </button>
      </>
    )
  }

  // One provider for the whole app lifetime, exactly like lib/providers.
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <App />
    </SWRConfig>,
  )
  const user = userEvent.setup()

  // First session: one request.
  await waitFor(() => expect(screen.getByText('loaded:value')).toBeTruthy())
  expect(recorded).toBe(1)

  // Logout unmounts the data hooks; the auth page mounts with none.
  await user.click(screen.getByText('to-auth'))
  await act(() => new Promise((resolve) => setTimeout(resolve, 25)))

  // Successful login purges before any dashboard hook mounts.
  await user.click(screen.getByText('purge'))
  await act(() => new Promise((resolve) => setTimeout(resolve, 25)))

  // Second session: the same key remounts while still inside the dedupe
  // window; settle briefly so a blocked fetch cannot slip behind the test.
  await user.click(screen.getByText('to-session2'))
  await act(() => new Promise((resolve) => setTimeout(resolve, 150)))

  expect(recorded).toBe(purgeRevalidate ? 2 : 1)
}

test('a revalidation-pass purge during login lets the next session re-fetch', async () => {
  fetchCalls = 0
  await runCrossSessionCycle(true)
  expect(screen.getByText('loaded:value')).toBeTruthy()
  expect(fetchCalls).toBe(2)
})

test('a revalidate-false purge alone leaves the key stuck on the skeleton inside the dedupe window', async () => {
  fetchCalls = 0
  await runCrossSessionCycle(false)
  // Exactly the observed regression after a logout-then-login without a
  // reload: the mount stays on the loading skeleton and never fetches.
  expect(screen.getByText('loading')).toBeTruthy()
  expect(fetchCalls).toBe(1)
})
