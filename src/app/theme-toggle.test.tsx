import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from './theme-toggle'

describe('ThemeToggle (RF-6)', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme
    document.cookie = 'theme=; path=/; max-age=0'
    localStorage.clear()
  })

  it('no dark, oferece mudar para claro', () => {
    render(<ThemeToggle initialTheme="dark" />)
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument()
  })

  it('clique aplica data-theme, cookie e localStorage e inverte o rótulo', () => {
    render(<ThemeToggle initialTheme="dark" />)
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.cookie).toContain('theme=light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(screen.getByRole('button', { name: 'Usar tema escuro' })).toBeInTheDocument()
  })

  it('segundo clique volta para dark', () => {
    render(<ThemeToggle initialTheme="dark" />)
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.cookie).toContain('theme=dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('sincroniza com o data-theme aplicado pelo script de fallback (cookie ausente)', () => {
    document.documentElement.dataset.theme = 'light'
    render(<ThemeToggle initialTheme="dark" />)
    expect(screen.getByRole('button', { name: 'Usar tema escuro' })).toBeInTheDocument()
  })
})
