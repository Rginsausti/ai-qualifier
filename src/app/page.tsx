import Image from 'next/image'
import { signIn, signUpForm } from './auth/actions'

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const checkEmail = (Array.isArray(sp?.checkEmail) ? sp?.checkEmail[0] : sp?.checkEmail) === '1'
  const err = Array.isArray(sp?.error) ? sp?.error[0] : sp?.error

  return (
    <main className="auth">
      <div className="auth__brand">
        <div className="auth__logo-wrap">
          <Image
            src="/ai-rgi-qualifier.png"
            alt="AI-RGI-QUALIFIER"
            width={240}
            height={240}
            className="auth__logo"
            priority
          />
        </div>
      </div>

      <div className="auth__grid">
        <form className="auth__card" action={signIn}>
          <h2 className="auth__title">Login</h2>
          <label className="auth__field">
            <span>email</span>
            <input className="auth__input" name="email" type="email" placeholder="you@domain.com" required />
          </label>
          <label className="auth__field">
            <span>password</span>
            <input className="auth__input" name="password" type="password" placeholder="••••••••" required />
          </label>
          <button className="auth__btn" type="submit">Sign in</button>
        </form>

        <form className="auth__card" action={signUpForm}>
          <h2 className="auth__title">Register</h2>
          <label className="auth__field">
            <span>email</span>
            <input className="auth__input" name="email" type="email" placeholder="you@domain.com" required />
          </label>
          <label className="auth__field">
            <span>password</span>
            <input className="auth__input" name="password" type="password" placeholder="••••••••" required />
          </label>
          <button className="auth__btn" type="submit">Sign up</button>

          {checkEmail && (
            <p className="auth__value" style={{ marginTop: 12 }}>
              Verification email sent. Check your inbox and click the link to finish signup.
            </p>
          )}
          {err && (
            <p className="auth__error" style={{ marginTop: 12 }}>
              {err}
            </p>
          )}
        </form>
      </div>
    </main>
  )
}
