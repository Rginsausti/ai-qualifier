import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookieItem = { name: string; value: string; options?: Record<string, unknown> }

export async function getSupabaseServer() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll().map(c => ({ name: c.name, value: c.value }))
        },
        setAll(cookiesToSet: CookieItem[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const maxAge = (options as { maxAge?: number } | undefined)?.maxAge
            if (maxAge === 0) {
              try { store.set(name, '', { maxAge: 0 } as unknown as never) } catch {}
            } else {
              try { store.set(name, value) } catch {}
            }
          })
        }
      }
    }
  )
}
