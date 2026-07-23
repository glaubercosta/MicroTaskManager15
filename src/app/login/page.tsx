'use client'

import { useActionState } from 'react'
import { signIn } from './actions'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, null)

  return (
    <main className="container" style={{ maxWidth: 360, marginTop: '10vh' }}>
      <h1>Entrar</h1>
      <form action={formAction}>
        <label>
          E-mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Senha
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {state?.error ? <p role="alert">{state.error}</p> : null}
        <button type="submit" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  )
}
