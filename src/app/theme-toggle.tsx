'use client'

import { useEffect, useState } from 'react'
import {
  parseTheme,
  themeCookie,
  toggleTheme,
  THEME_COOKIE,
  type Theme,
} from '@/domain/theme'

/**
 * Alterna o tema sem round-trip: muda o data-theme (paint imediato) e persiste
 * em cookie (próximo SSR resolve no servidor) + localStorage (fallback, RF-6).
 */
export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  // O script inline de fallback pode ter aplicado localStorage antes da hidratação.
  useEffect(() => {
    const applied = document.documentElement.dataset.theme
    // Sync deliberado pós-hidratação: initializer leria o DOM no render e causaria mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (applied !== undefined) setTheme(parseTheme(applied))
  }, [])

  function handleClick() {
    const next = toggleTheme(theme)
    document.documentElement.dataset.theme = next
    document.cookie = themeCookie(next, location.protocol === 'https:')
    try {
      localStorage.setItem(THEME_COOKIE, next)
    } catch {
      // localStorage indisponível (ex.: bloqueado) — cookie já persiste.
    }
    setTheme(next)
  }

  return (
    <button type="button" onClick={handleClick}>
      {theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
    </button>
  )
}
