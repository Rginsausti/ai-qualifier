import { signIn, signUp } from './auth/actions'

export default function Page() {
  return (
    <main className="auth">
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

        <form className="auth__card" action={signUp}>
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
        </form>
      </div>
    </main>
  )
}
