/** Valida e normaliza o título de uma tarefa (RF-3.2). Lança se vazio. */
export function validateTitle(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new Error('O título da tarefa não pode ser vazio.')
  }
  return trimmed
}

export type Priority = 'low' | 'medium' | 'high'
export type Status = 'new' | 'working' | 'done' | 'canceled'

export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high']
export const STATUSES: readonly Status[] = ['new', 'working', 'done', 'canceled']

/** Rótulos pt-BR (RNF-4): valores internos em inglês, exibição em português. */
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}
export const STATUS_LABELS: Record<Status, string> = {
  new: 'Nova',
  working: 'Trabalhando',
  done: 'Concluída',
  canceled: 'Cancelada',
}

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value)
}

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value)
}

/**
 * Normaliza um prazo vindo de formulário. Vazio → null (limpar). Valida AAAA-MM-DD (RF-3.4).
 * Só valida o formato aqui; a validade de calendário (ex.: rejeitar 2026-13-45) fica a cargo
 * da coluna `date` do Postgres — não é uma omissão.
 */
export function normalizeDueDate(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Prazo inválido (use AAAA-MM-DD).')
  }
  return trimmed
}
