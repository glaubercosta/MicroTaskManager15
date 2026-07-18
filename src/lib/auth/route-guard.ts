const PUBLIC_PREFIXES = ['/login']

export function shouldRedirectToLogin(input: {
  hasUser: boolean
  pathname: string
}): boolean {
  if (input.hasUser) return false
  return !PUBLIC_PREFIXES.some((prefix) => input.pathname.startsWith(prefix))
}
