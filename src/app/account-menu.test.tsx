import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AccountMenu } from './account-menu'

describe('AccountMenu (RF-6)', () => {
  it('mostra o e-mail da sessão como gatilho do menu', () => {
    render(
      <AccountMenu email="dono@example.com" theme="dark" signOutAction={async () => {}} />,
    )
    expect(screen.getByText('dono@example.com')).toBeInTheDocument()
  })

  it('contém o toggle de tema e o botão Sair', () => {
    render(
      <AccountMenu email="dono@example.com" theme="dark" signOutAction={async () => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('submeter o formulário Sair invoca a action injetada', async () => {
    const signOut = vi.fn(async () => {})
    render(<AccountMenu email="dono@example.com" theme="dark" signOutAction={signOut} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce())
  })
})
