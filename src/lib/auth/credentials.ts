export type CredentialsCheck = { ok: true } | { ok: false; error: string }

export function validateCredentials(email: string, password: string): CredentialsCheck {
  const e = email.trim()
  if (e.length === 0) return { ok: false, error: 'Informe o e-mail.' }
  if (!e.includes('@')) return { ok: false, error: 'E-mail inválido.' }
  if (password.length === 0) return { ok: false, error: 'Informe a senha.' }
  return { ok: true }
}
