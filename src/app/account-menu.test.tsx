import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
