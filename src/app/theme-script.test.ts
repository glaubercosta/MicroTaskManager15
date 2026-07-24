import { describe, it, expect, beforeEach } from 'vitest'
import { themeFallbackScript } from './theme-script'

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

describe('themeFallbackScript (GC-20)', () => {
  beforeEach(() => {
    clearCookie('theme')
    clearCookie('x-theme')
    delete document.documentElement.dataset.theme
    localStorage.clear()
  })

  it('sem cookie: aplica o tema do localStorage e regrava o cookie', () => {
    localStorage.setItem('theme', 'light')
    eval(themeFallbackScript)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.cookie).toContain('theme=light')
  })

  it("'x-theme=' não conta como cookie de tema (parsing exato)", () => {
    document.cookie = 'x-theme=dark; path=/'
    localStorage.setItem('theme', 'light')
    eval(themeFallbackScript)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('com cookie de tema presente, não faz nada', () => {
    document.cookie = 'theme=dark; path=/'
    localStorage.setItem('theme', 'light')
    eval(themeFallbackScript)
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('valor inválido no localStorage é ignorado', () => {
    localStorage.setItem('theme', 'solarized')
    eval(themeFallbackScript)
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('parsing novo sem indexOf; secure condicionado a HTTPS; samesite=lax mantido', () => {
    expect(themeFallbackScript).not.toContain('indexOf')
    expect(themeFallbackScript).toContain(".startsWith('theme=')")
    expect(themeFallbackScript).toContain("location.protocol==='https:'")
    expect(themeFallbackScript).toContain('samesite=lax')
  })
})
