import { getSupabaseServer } from '@/lib/supabase/server'
import { signOut } from '../auth/actions'

export default async function Dashboard() {
  const supabase = await getSupabaseServer()
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email ?? 'anonymous'
  return (
    <main style={{ padding:24 }}>
      <h1>Dashboard</h1>
      <p>{email}</p>
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  )
}
