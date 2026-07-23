import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriorityDot } from './priority-dot'

describe('PriorityDot (RF-4.2)', () => {
  it('expõe a prioridade por texto no aria-label (não depende de cor)', () => {
    render(<PriorityDot priority="high" />)
    expect(screen.getByLabelText('Prioridade: Alta')).toBeInTheDocument()
  })

  it('traduz cada prioridade para o rótulo pt-BR', () => {
    const { rerender } = render(<PriorityDot priority="low" />)
    expect(screen.getByLabelText('Prioridade: Baixa')).toBeInTheDocument()
    rerender(<PriorityDot priority="medium" />)
    expect(screen.getByLabelText('Prioridade: Média')).toBeInTheDocument()
  })

  it('expõe a prioridade como data-attribute para o peso visual monocromático (GC-17)', () => {
    render(<PriorityDot priority="high" />)
    const dot = screen.getByLabelText('Prioridade: Alta')
    expect(dot).toHaveAttribute('data-priority', 'high')
    expect(dot).toHaveClass('priority-dot')
  })
})
