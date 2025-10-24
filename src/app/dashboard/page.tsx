// src/app/dashboard/page.tsx
'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import {
  summarizeDomainAction,
  generateICPFromSummaryAction,
  saveICPAction,
  qualifyProspectAction,
  getRecentRunsAction,
  signOut,
  type ICP,
  type QualificationRunRow,
  type RunsState,
  type QualifyState,
  type SaveICPResult
} from '../auth/actions'

type SummaryState = { summary: string; error?: string }
type IcpState = { icp: ICP | null; error?: string }

function SubmitBtn({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button className="auth__btn" type="submit" disabled={pending || disabled}>
      {pending ? 'Working…' : children}
    </button>
  )
}

export default function Dashboard() {
  const [summaryState, summarizeAction] = useActionState<SummaryState, FormData>(summarizeDomainAction, { summary: '' })
  const [icpState, generateAction] = useActionState<IcpState, FormData>(generateICPFromSummaryAction, { icp: null })
  const [saveState, saveAction] = useActionState<SaveICPResult | undefined, FormData>(saveICPAction, undefined)
  const [qualifyState, qualifyAction] = useActionState<QualifyState, FormData>(qualifyProspectAction, { score: null, reasoning: '' })
  const [runsState, getRunsAction] = useActionState<RunsState, FormData>(getRecentRunsAction, { runs: [] })

  const hasSummary = !!summaryState.summary?.trim()
  const icpJson = icpState.icp ? JSON.stringify(icpState.icp) : ''
  const hasICP = icpJson.length > 0

  const refreshFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    refreshFormRef.current?.requestSubmit()
  }, [])

  useEffect(() => {
    if (qualifyState.score !== null) {
      refreshFormRef.current?.requestSubmit()
    }
  }, [qualifyState.score])

  const reasoningTextFromUnknown = (u: unknown): string => {
    if (typeof u === 'string') return u
    if (u && typeof u === 'object' && 'reasoning' in u && typeof (u as { reasoning: unknown }).reasoning === 'string') {
      return (u as { reasoning: string }).reasoning
    }
    try {
      return JSON.stringify(u)
    } catch {
      return ''
    }
  }

  const runs: QualificationRunRow[] =
    (qualifyState.runs && qualifyState.runs.length > 0 ? qualifyState.runs : runsState.runs) || []

  return (
    <main className="dash">
      <div className="dash__wrap">
        <form ref={refreshFormRef} action={getRunsAction}><input type="hidden" name="refresh" value="1" /></form>

        <div className="auth__card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="auth__title" style={{ margin: 0 }}>Dashboard</h1>
          <form action={signOut}>
            <button className="auth__btn" type="submit">Logout</button>
          </form>
        </div>

        <section className="auth__card">
          <h2 className="auth__title">1) Summarize domain</h2>
          <form action={summarizeAction}>
            <label className="auth__field">
              <span>domain</span>
              <input className="auth__input" name="domain" type="text" placeholder="stripe.com" required />
            </label>
            <SubmitBtn>Summarize</SubmitBtn>
          </form>
          {summaryState.error ? <p className="auth__error">{summaryState.error}</p> : null}
          {hasSummary ? <textarea className="auth__input" readOnly value={summaryState.summary} rows={6} /> : null}
        </section>

        <section className="auth__card" style={{ marginTop: 16 }}>
          <h2 className="auth__title">2) Generate ICP</h2>
          <form action={generateAction}>
            <input type="hidden" name="summary" value={summaryState.summary || ''} />
            <SubmitBtn disabled={!hasSummary}>Generate ICP (Groq)</SubmitBtn>
          </form>
          {icpState.error ? <p className="auth__error">{icpState.error}</p> : null}
          {hasICP ? <pre className="auth__input" style={{ whiteSpace: 'pre-wrap' }}>{icpJson}</pre> : null}
        </section>

        <section className="auth__card" style={{ marginTop: 16 }}>
          <h2 className="auth__title">3) Save ICP</h2>
          <form action={saveAction}>
            <input type="hidden" name="icp" value={icpJson} />
            <SubmitBtn disabled={!hasICP}>Save ICP</SubmitBtn>
          </form>
          {saveState && 'ok' in saveState && saveState.ok ? (
            <p className="auth__value">Saved ICP Profile ID: {saveState.icp_profile_id}</p>
          ) : null}
          {saveState && 'error' in saveState ? <p className="auth__error">{saveState.error}</p> : null}
        </section>

        <section className="auth__card" style={{ marginTop: 16 }}>
          <h2 className="auth__title">4) Qualify Prospect</h2>
          <form action={qualifyAction}>
            <input type="hidden" name="icp" value={icpJson} />
            <input type="hidden" name="icp_profile_id" value={saveState && 'ok' in saveState && saveState.ok ? (saveState.icp_profile_id ?? '') : ''} />
            <label className="auth__field">
              <span>prospect summary</span>
              <textarea className="auth__input" name="prospect" rows={6} placeholder="Paste prospect text…" required />
            </label>
            <SubmitBtn disabled={!hasICP}>Qualify</SubmitBtn>
          </form>
          {qualifyState.error ? <p className="auth__error">{qualifyState.error}</p> : null}
          {qualifyState.score !== null ? (
            <div className="auth__meta" style={{ marginTop: 8 }}>
              <div className="dash__row"><span className="dash__label">Score</span><span className="dash__value">{qualifyState.score}</span></div>
              <div className="dash__row"><span className="dash__label">Reasoning</span><span className="dash__value">{qualifyState.reasoning}</span></div>
            </div>
          ) : null}
        </section>

        <section className="auth__card" style={{ marginTop: 16 }}>
          <h2 className="auth__title">Recent qualification runs</h2>
          {runs.length === 0 ? (
            <p className="auth__value">No runs yet.</p>
          ) : (
            <ul className="auth__list">
              {runs.map((r, idx) => (
                <li key={r.id} className="auth__row" style={{ paddingTop: 8, paddingBottom: 8 }}>
                  <h3 className="auth__title" style={{ fontSize: 16, marginBottom: 8 }}>
                    Qualification • {new Date(r.created_at).toLocaleString()}
                  </h3>
                  <div className="dash__row"><span className="dash__label">Score</span><span className="dash__value">{r.score}</span></div>
                  <div className="dash__row"><span className="dash__label">Reasoning</span><span className="dash__value">{reasoningTextFromUnknown(r.reasoning_log)}</span></div>
                  {idx < runs.length - 1 ? <hr style={{ border: 0, borderTop: '1px solid #2a2f3a', marginTop: 12 }} /> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
