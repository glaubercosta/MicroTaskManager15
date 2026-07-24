import { describe, it, expect } from 'vitest'
import {
  THEMES,
  DEFAULT_THEME,
  THEME_COOKIE,
  parseTheme,
  toggleTheme,
  hasThemeCookie,
  themeCookie,
} from './theme'

describe('tema (RF-6)', () => {
  it('dark é o tema padrão', () => {
    expect(DEFAULT_THEME).toBe('dark')
    expect(THEMES).toEqual(['dark', 'light'])
  })

  it('parseTheme aceita apenas valores válidos', () => {
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('light')).toBe('light')
  })

  it('parseTheme cai no padrão para lixo/ausência (cookie adulterado, RNF)', () => {
    expect(parseTheme(undefined)).toBe('dark')
    expect(parseTheme(null)).toBe('dark')
    expect(parseTheme('')).toBe('dark')
    expect(parseTheme('LIGHT')).toBe('dark')
    expect(parseTheme('solarized')).toBe('dark')
  })

  it('toggleTheme alterna entre os dois temas', () => {
    expect(toggleTheme('dark')).toBe('light')
    expect(toggleTheme('light')).toBe('dark')
  })

  it('nome do cookie é estável (contrato com layout/toggle/script inline)', () => {
    expect(THEME_COOKIE).toBe('theme')
  })
})

describe('hasThemeCookie (GC-20)', () => {
  it('string vazia → false', () => {
    expect(hasThemeCookie('')).toBe(false)
  })
  it('só theme= → true', () => {
    expect(hasThemeCookie('theme=dark')).toBe(true)
    expect(hasThemeCookie('theme=')).toBe(true)
  })
  it('x-theme= sem theme= → false (prefixo exato, não substring)', () => {
    expect(hasThemeCookie('x-theme=light')).toBe(false)
  })
  it('x-theme= e theme= juntos → true', () => {
    expect(hasThemeCookie('x-theme=light; theme=dark')).toBe(true)
  })
})

describe('themeCookie (GC-20)', () => {
  it('sob HTTP não emite Secure e mantém SameSite=Lax', () => {
    expect(themeCookie('dark', false)).toBe(
      'theme=dark; path=/; max-age=31536000; samesite=lax',
    )
  })
  it('sob HTTPS anexa Secure (e mantém SameSite=Lax)', () => {
    const c = themeCookie('light', true)
    expect(c).toContain('samesite=lax')
    expect(c.endsWith('; secure')).toBe(true)
  })
})
