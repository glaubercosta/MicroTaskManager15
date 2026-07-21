import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DueBadge } from './due-badge'

const TODAY = '2026-07-21'

describe('DueBadge (RF-4.2/RF-5.2)', () => {
  it('sem prazo → não renderiza nada', () => {
    const { container } = render(<DueBadge dueDate={null} today={TODAY} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('prazo de hoje → destaca "Hoje" por texto (não só cor)', () => {
    render(<DueBadge dueDate="2026-07-21" today={TODAY} />)
    expect(screen.getByText(/Hoje/)).toBeInTheDocument()
  })

  it('prazo passado → destaca "Atrasada" por texto', () => {
    render(<DueBadge dueDate="2026-07-20" today={TODAY} />)
    expect(screen.getByText(/Atrasada/)).toBeInTheDocument()
  })

  it('prazo futuro → mostra a data sem rótulo de urgência', () => {
    render(<DueBadge dueDate="2026-07-30" today={TODAY} />)
    expect(screen.getByText(/2026-07-30/)).toBeInTheDocument()
    expect(screen.queryByText(/Hoje|Atrasada/)).not.toBeInTheDocument()
  })
})
