import { describe, it, expect } from 'vitest'
import { shouldRedirectToLogin } from './route-guard'

describe('shouldRedirectToLogin', () => {
  it('redireciona quando não há usuário e a rota não é pública', () => {
    expect(shouldRedirectToLogin({ hasUser: false, pathname: '/' })).toBe(true)
  })

  it('não redireciona quando não há usuário mas a rota é /login', () => {
    expect(shouldRedirectToLogin({ hasUser: false, pathname: '/login' })).toBe(false)
  })

  it('não redireciona quando há usuário', () => {
    expect(shouldRedirectToLogin({ hasUser: true, pathname: '/' })).toBe(false)
  })

  it('trata sub-rotas de /login como públicas', () => {
    expect(shouldRedirectToLogin({ hasUser: false, pathname: '/login/reset' })).toBe(false)
  })
})
