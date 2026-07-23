export type Theme = 'dark' | 'light'

export const THEMES: readonly Theme[] = ['dark', 'light']

/** Escuro por padrão (RF-6). */
export const DEFAULT_THEME: Theme = 'dark'

/** Nome do cookie/chave localStorage — contrato com layout, toggle e script inline. */
export const THEME_COOKIE = 'theme'

/** 1 ano. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Valida valor vindo de cookie/localStorage; qualquer coisa inválida → padrão. */
export function parseTheme(value: string | null | undefined): Theme {
  return (THEMES as readonly string[]).includes(value ?? '')
    ? (value as Theme)
    : DEFAULT_THEME
}

export function toggleTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}
