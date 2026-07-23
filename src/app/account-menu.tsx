import { ThemeToggle } from './theme-toggle'
import type { Theme } from '@/domain/theme'

/** Menu da conta na barra de topo: e-mail como gatilho, toggle de tema e Sair (RF-6). */
export function AccountMenu({
  email,
  theme,
  signOutAction,
}: {
  email: string
  theme: Theme
  signOutAction: () => Promise<void>
}) {
  return (
    <details className="account-menu">
      <summary>{email}</summary>
      <div>
        <ThemeToggle initialTheme={theme} />
        <form action={signOutAction}>
          <button type="submit">Sair</button>
        </form>
      </div>
    </details>
  )
}
