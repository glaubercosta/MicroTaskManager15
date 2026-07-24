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

/** Detecção exata do cookie de tema num document.cookie: 'x-theme=' não casa (GC-20). */
export function hasThemeCookie(cookieString: string): boolean {
  return cookieString.split('; ').some((c) => c.startsWith(`${THEME_COOKIE}=`))
}

/** Serializa o cookie de tema; `Secure` só sob HTTPS — dev local via HTTP segue gravando (GC-20). */
export function themeCookie(theme: Theme, isHttps: boolean): string {
  const base = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
  return isHttps ? `${base}; secure` : base
}
