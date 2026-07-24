import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * GC-19 (WCAG 1.4.11): os tokens --dot-* devem ter contraste ≥3:1 contra o
 * fundo do respectivo tema, lidos direto de globals.css.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'globals.css'),
  'utf8',
)

/** Luminância relativa WCAG de uma cor #rrggbb. */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razão de contraste WCAG entre duas cores #rrggbb. */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function themeBlock(theme: 'dark' | 'light'): string {
  const re =
    theme === 'dark' ? /:root \{([^}]*)\}/ : /:root\[data-theme='light'\] \{([^}]*)\}/
  const m = css.match(re)
  if (!m) throw new Error(`bloco do tema ${theme} não encontrado em globals.css`)
  return m[1]
}

function token(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`token ${name} não encontrado`)
  return m[1]
}

const PRIORITIES = ['high', 'medium', 'low'] as const

describe.each(['dark', 'light'] as const)('tokens --dot-* no tema %s (GC-19)', (theme) => {
  const block = themeBlock(theme)
  const background = token(block, '--background')

  it.each([...PRIORITIES])('--dot-%s tem contraste ≥3:1 contra o fundo', (p) => {
    expect(contrastRatio(token(block, `--dot-${p}`), background)).toBeGreaterThanOrEqual(3)
  })

  it('preserva a hierarquia visual: high > medium > low em contraste', () => {
    const [high, medium, low] = PRIORITIES.map((p) =>
      contrastRatio(token(block, `--dot-${p}`), background),
    )
    expect(high).toBeGreaterThan(medium)
    expect(medium).toBeGreaterThan(low)
  })
})

it('o dot não usa mais peso por opacidade (cores sólidas por token)', () => {
  expect(css).not.toMatch(/\.priority-dot\[data-priority[^}]*opacity/)
})
