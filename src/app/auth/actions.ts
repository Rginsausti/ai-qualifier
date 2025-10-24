'use server'

import Groq from 'groq-sdk'
import { z } from 'zod'
import { redirect, RedirectType } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getSupabaseServer } from '@/lib/supabase/server'
import { fetchCompanySummary } from '@/lib/fetchCompanySummary'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

async function siteURL(): Promise<string> {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  const fromHeader = ((await headers()).get('origin') ?? '').trim()
  const base = (fromEnv || fromHeader).replace(/\/+$/, '')
  return base || 'http://localhost:3000'
}

export type SignUpResult = { ok: boolean; message?: string; error?: string }

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

export async function signIn(formData: FormData) {
  const supabase = getSupabaseServer()
  const parsed = credsSchema.safeParse({
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || '')
  })
  if (!parsed.success) redirect('/?error=Invalid+credentials')

  const { error } = await (await supabase).auth.signInWithPassword(parsed.data)
  if (error) redirect(`/?error=${encodeURIComponent(error.message)}`)

  redirect('/dashboard')
}

export async function signUpForm(formData: FormData) {
  const supabase = getSupabaseServer()
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const parsed = credsSchema.safeParse({ email, password })
  if (!parsed.success) redirect('/?error=Invalid+data')

  const base = await siteURL()
  const emailRedirectTo = `${base}/auth/callback?next=/dashboard`

  const { error } = await (await supabase).auth.signUp({
    email,
    password,
    options: { emailRedirectTo }
  })

  // Si ya existe o cualquier otra cosa, intentamos re-enviar igual
  if (error) {
    try {
      const r = await (await supabase).auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo }
      })
      if (r.error) redirect(`/?error=${encodeURIComponent(`resend:${r.error.code||''}:${r.error.message}`)}`)
      redirect('/?checkEmail=resent')
    } catch (e:unknown) {
      redirect(`/?error=${encodeURIComponent(`resend-throw:${(e as Error)?.message||'unknown'}`)}`)
    }
  }

  // Incluso si no hubo error, reenvía para el caso "repeated_signup" silencioso.
  const r2 = await (await supabase).auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo }
  })
  if (r2.error) redirect(`/?error=${encodeURIComponent(`resend2:${r2.error.code||''}:${r2.error.message}`)}`)

  redirect('/?checkEmail=1')
}

export async function signUp(
  _prev: SignUpResult,
  formData: FormData
): Promise<SignUpResult> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  if (!email || !password) return { ok: false, error: 'Missing credentials' }
  const supabase = await getSupabaseServer()
  const url = await siteURL()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${url}/auth/callback` }
  })
  if (error) return { ok: false, error: error.message }
  if (!data.session) {
    return { ok: true, message: `Verification email sent to ${email}. Check your inbox to finish signup.` }
  }
  redirect('/dashboard', RedirectType.replace)
}


export type SummaryState = { summary: string; error?: string }

export async function summarizeDomainAction(
  _prev: SummaryState,
  formData: FormData
): Promise<SummaryState> {
  const domain = String(formData.get('domain') || '').trim()
  const store = await cookies()
  if (!domain) {
    store.delete('icp_summary')
    revalidatePath('/dashboard')
    return { summary: '', error: 'missing domain' }
  }
  try {
    const summary = await fetchCompanySummary(domain)
    store.set('icp_summary', summary, { path: '/', maxAge: 3600 })
    revalidatePath('/dashboard')
    return { summary }
  } catch {
    store.delete('icp_summary')
    revalidatePath('/dashboard')
    return { summary: '', error: 'blocked or unreachable' }
  }
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServer()
  await supabase.auth.signOut()
  redirect('/')
}

const ICPschema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  buyer_personas: z
    .array(
      z.object({
        role: z.string().min(2),
        goals: z.string().min(5),
        pain_points: z.string().min(5),
        decision_power: z.string().min(2)
      })
    )
    .min(3)
    .max(5),
  company_size: z.string().min(2),
  revenue_range: z.string().min(2),
  funding_stage: z.string().min(2),
  regions: z.array(z.string().min(2)).min(1)
})
export type ICP = z.infer<typeof ICPschema>

function extractJson(text: string): string {
  const code = text.match(/```json\s*([\s\S]*?)```/i)?.[1]
  if (code) return code.trim()
  return text.trim()
}

type GroqAPIError = Error & {
  code?: string
  status?: number
  error?: { message?: string; type?: string; code?: string }
}
function errorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const e = err as GroqAPIError
    return e.error?.message ?? (e as Error).message ?? JSON.stringify(e)
  }
  return 'Unknown error'
}
function isModelDecommissioned(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase()
  return msg.includes('model_decommissioned') || msg.includes('does not exist')
}

const CANDIDATE_MODELS = ['llama-3.1-70b', 'llama-3.1-8b-instant', 'llama-3.1-8b', 'gemma2-9b-it'] as const
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

async function chatOnce(
  model: (typeof CANDIDATE_MODELS)[number],
  messages: ChatMessage[]
) {
  return groq.chat.completions.create({ model, temperature: 0.2, messages })
}

export async function generateICP(companySummary: string): Promise<ICP> {
  if (!companySummary?.trim()) throw new Error('Missing company summary')
  const system = [
    'Return ONLY a valid JSON object that EXACTLY matches this schema:',
    'title:string(min3), description:string(min10),',
    'buyer_personas: array 3..5 of objects {role:string(min2), goals:string(min5), pain_points:string(min5), decision_power:string(min2)},',
    'company_size:string(min2), revenue_range:string(min2), funding_stage:string(min2), regions: string[](min1 and each item min2).',
    'All properties must be strings. No nulls, no numbers, no booleans.',
    'Do not include any text outside JSON or code fences.'
  ].join(' ')
  const user = [
    'Company summary between triple quotes. Generate the ICP based on that content only. Do not invent placeholders or defaults; fill every field with information consistent with the summary.',
    '"""',
    companySummary,
    '"""'
  ].join('\n')
  let first
  for (const m of CANDIDATE_MODELS) {
    try {
      first = await chatOnce(m, [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ])
      break
    } catch (err: unknown) {
      if (isModelDecommissioned(err)) continue
      throw new Error(errorMessage(err))
    }
  }
  if (!first) throw new Error('No available Groq model from candidates')
  let content = first.choices[0]?.message?.content ?? ''
  let jsonStr = extractJson(content)
  try {
    const parsed = JSON.parse(jsonStr)
    const checked = ICPschema.safeParse(parsed)
    if (checked.success) return checked.data
    const issues = checked.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    let second
    for (const m of CANDIDATE_MODELS) {
      try {
        second = await chatOnce(m, [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              'Fix the JSON so it meets the schema and the following errors:',
              issues,
              'Previous JSON:',
              JSON.stringify(parsed)
            ].join('\n')
          }
        ])
        break
      } catch (err: unknown) {
        if (isModelDecommissioned(err)) continue
        throw new Error(errorMessage(err))
      }
    }
    if (!second) throw new Error('No available Groq model for retry')
    content = second.choices[0]?.message?.content ?? ''
    jsonStr = extractJson(content)
    const reparsed = JSON.parse(jsonStr)
    return ICPschema.parse(reparsed)
  } catch {
    throw new Error('Invalid ICP JSON')
  }
}

export type IcpState = { icp: ICP | null; error?: string }

export async function generateICPFromSummaryAction(
  _prev: IcpState,
  formData: FormData
): Promise<IcpState> {
  const summary = String(formData.get('summary') || '').trim()
  if (!summary) return { icp: null, error: 'missing summary' }
  try {
    const icp = await generateICP(summary)
    return { icp }
  } catch {
    return { icp: null, error: 'invalid summary' }
  }
}

export type SaveICPResult =
  | { ok: true; icp_profile_id: string }
  | { ok: false; error: string }

async function ensureUserAndCompany(): Promise<{ user_id: string; company_id: string }> {
  const supabase = await getSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  const user_id = auth.user?.id ?? ''
  if (!user_id) throw new Error('no auth')
  const { data: userRow } = await supabase.from('users').select('id, company_id, email').eq('id', user_id).maybeSingle()
  if (userRow?.company_id) return { user_id, company_id: userRow.company_id as string }
  const email = userRow?.email ?? auth.user?.email ?? ''
  const fallbackName = (email.split('@')[1] || 'personal') + '-' + user_id.slice(0, 8)
  const { data: company } = await supabase
    .from('companies')
    .insert({ name: fallbackName })
    .select('id')
    .maybeSingle()
  const company_id = company?.id as string
  if (!userRow) {
    await supabase.from('users').insert({ id: user_id, email, company_id })
  } else {
    await supabase.from('users').update({ company_id }).eq('id', user_id)
  }
  return { user_id, company_id }
}

export async function saveICPAction(
  _prev: SaveICPResult | undefined,
  formData: FormData
): Promise<SaveICPResult> {
  try {
    const icpRaw = String(formData.get('icp') || '')
    const icp = ICPschema.parse(JSON.parse(icpRaw))
    const { company_id } = await ensureUserAndCompany()
    const supabase = await getSupabaseServer()
    const { data, error } = await supabase
      .from('icp_profiles')
      .insert([{ company_id, name: icp.title, icp_data: icp }])
      .select('id')
      .maybeSingle()
    if (error || !data?.id) return { ok: false, error: error?.message || 'save failed' }
    return { ok: true, icp_profile_id: data.id as string }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'save failed' }
  }
}

const QualifySchema = z.object({
  score: z.number().int().min(1).max(100),
  reasoning: z.string().min(10)
})
export type QualifyResult = z.infer<typeof QualifySchema>

async function groqJSONPrompt(system: string, user: string): Promise<string> {
  let first
  for (const m of CANDIDATE_MODELS) {
    try {
      first = await chatOnce(m, [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ])
      break
    } catch (err: unknown) {
      if (isModelDecommissioned(err)) continue
      throw new Error(errorMessage(err))
    }
  }
  if (!first) throw new Error('No available Groq model from candidates')
  const content = first.choices[0]?.message?.content ?? ''
  return extractJson(content)
}

export async function qualifyProspect(icp: ICP, prospectSummary: string): Promise<QualifyResult> {
  if (!prospectSummary?.trim()) throw new Error('Missing prospect summary')
  const system = [
    'Compare an Ideal Customer Profile (ICP) with a prospect summary.',
    'Return ONLY a JSON object with schema: {"score": integer 1..100, "reasoning": string}.',
    'Be concise, evidence-based, and consistent with the ICP.',
    'Do not include any text outside JSON or code fences.'
  ].join(' ')
  const user = [
    'ICP JSON:',
    JSON.stringify(icp),
    'Prospect summary between triple quotes:',
    '"""',
    prospectSummary,
    '"""'
  ].join('\n')
  const first = await groqJSONPrompt(system, user)
  try {
    const parsed: unknown = JSON.parse(first)
    const checked = QualifySchema.safeParse(parsed)
    if (checked.success) return checked.data
    const issues = checked.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    const retryUser = [
      'The previous JSON did not match the schema. Fix it following these errors:',
      issues,
      'Previous JSON:',
      JSON.stringify(parsed)
    ].join('\n')
    const second = await groqJSONPrompt(system, retryUser)
    const reparsed: unknown = JSON.parse(second)
    return QualifySchema.parse(reparsed)
  } catch {
    throw new Error('Invalid qualify JSON')
  }
}

export type QualificationRunRow = {
  id: string
  created_at: string
  score: number
  reasoning_log: unknown
}

export async function listQualificationRuns() {
  const supabase = await getSupabaseServer()
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id ?? ''
  if (!uid) return []
  const { data } = await supabase
    .from('qualification_runs')
    .select('id, created_at, score, reasoning_log, prospect_url')
    .eq('candidate_user_id', uid)
    .order('created_at', { ascending: false })
    .limit(10)
  return (data ?? []) as {
    id: string; created_at: string; score: number; reasoning_log: unknown; prospect_url: string | null
  }[]
}

export type RunsState = { runs: QualificationRunRow[] }
export async function getRecentRunsAction(_prev: RunsState, _fd: FormData): Promise<RunsState> {
  const runs = await listQualificationRuns()
  return { runs }
}

export type QualifyState = { score: number | null; reasoning: string; error?: string; runs?: QualificationRunRow[] }

export async function qualifyProspectAction(
  _prev: QualifyState,
  formData: FormData
): Promise<QualifyState> {
  const icpRaw = String(formData.get('icp') || '').trim()
  let icpProfileId = String(formData.get('icp_profile_id') || '').trim()
  const prospect = String(formData.get('prospect') || '').trim()
  if (!icpRaw || !prospect) return { score: null, reasoning: '', error: 'missing inputs' }

  try {
    const icp = ICPschema.parse(JSON.parse(icpRaw))
    if (!icpProfileId) {
      const { company_id } = await ensureUserAndCompany()
      const supabaseCreate = await getSupabaseServer()
      const { data: created } = await supabaseCreate
        .from('icp_profiles')
        .insert([{ company_id, name: icp.title, icp_data: icp }])
        .select('id')
        .maybeSingle()
      icpProfileId = created?.id as string
    }

    const result = await qualifyProspect(icp, prospect)
    const supabase = await getSupabaseServer()
    const { data: auth } = await supabase.auth.getUser()
    const candidateUserId: string | null = auth.user?.id ?? null
    await supabase.from('qualification_runs').insert({
      icp_profile_id: icpProfileId,
      candidate_user_id: candidateUserId,
      status: 'succeeded',
      score: result.score,
      reasoning_log: result,
      prospect_summary: prospect
    })
    revalidatePath('/dashboard')
    const runs = await listQualificationRuns()
    return { score: result.score, reasoning: result.reasoning, runs }
  } catch (e) {
    return { score: null, reasoning: '', error: e instanceof Error ? e.message : 'qualification failed' }
  }
}
