'use server'

import { redirect } from 'next/navigation'
import { getSupabaseServer } from '@/lib/supabase/server'

export async function signUp(formData: FormData): Promise<void> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await getSupabaseServer()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` }
  })
  if (error) return
}

export async function signIn(formData: FormData): Promise<void> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await getSupabaseServer()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return
  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServer()
  await supabase.auth.signOut()
  redirect('/')
}
