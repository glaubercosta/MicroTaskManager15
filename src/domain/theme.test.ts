import { describe, it, expect } from 'vitest'
import {
  THEMES,
  DEFAULT_THEME,
  THEME_COOKIE,
  parseTheme,
  toggleTheme,
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
