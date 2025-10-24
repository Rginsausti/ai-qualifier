'use client'

import { useActionState } from 'react'
import { summarizeDomainAction, SummaryState } from '../auth/actions'

export default function SummaryForm() {
  const [state, formAction, pending] = useActionState<SummaryState, FormData>(
    summarizeDomainAction,
    { summary: '' }
  )

  return (
    <section className="auth__card" style={{ marginTop: 16 }}>
      <h2 className="auth__title">Company summary</h2>
      <form action={formAction} className="auth__field" style={{ gap: 10 }}>
        <input className="auth__input" name="domain" placeholder="example.com" required />
        <button className="auth__btn" disabled={pending} type="submit">
          {pending ? 'Fetching…' : 'Summarize'}
        </button>
      </form>
      {state.summary && (
        <div style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{state.summary}</div>
      )}
    </section>
  )
}
