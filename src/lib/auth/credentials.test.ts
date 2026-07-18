import { describe, it, expect } from 'vitest'
import { validateCredentials } from './credentials'

describe('validateCredentials', () => {
  it('aceita e-mail e senha válidos', () => {
    expect(validateCredentials('dono@exemplo.com', 'segredo123')).toEqual({ ok: true })
  })
  it('rejeita e-mail vazio', () => {
    expect(validateCredentials('  ', 'segredo123').ok).toBe(false)
  })
  it('rejeita e-mail sem @', () => {
    expect(validateCredentials('donoexemplo.com', 'segredo123').ok).toBe(false)
  })
  it('rejeita senha vazia', () => {
    expect(validateCredentials('dono@exemplo.com', '').ok).toBe(false)
  })
})
