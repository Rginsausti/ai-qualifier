'use client'
import { useState, useTransition } from 'react'
import { generateICP, ICP } from '../auth/actions'

export default function ICPButton({ summary }: { summary: string }) {
  const [data, setData] = useState<ICP | null>(null)
  const [pending, start] = useTransition()
  const hasSummary = !!summary?.trim()

  return (
    <div>
      <button
        onClick={() =>
          start(async () => {
            if (!hasSummary) return
            setData(await generateICP(summary))
          })
        }
        disabled={pending || !hasSummary}
      >
        {pending ? 'Generando…' : 'Generar ICP (Groq)'}
      </button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  )
}
