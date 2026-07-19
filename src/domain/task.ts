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

export interface SortableTask {
  priority: Priority
  due_date: string | null
}

/** Linha de tarefa como vem do banco (para o render). */
export interface Task extends SortableTask {
  id: string
  title: string
  status: Status
  list_id: string | null
  created_at: string
}

const PRIORITY_RANK: Record<Priority, number> = Object.fromEntries(
  PRIORITIES.map((p, i) => [p, i]),
) as Record<Priority, number>
const OPEN_STATUSES: readonly Status[] = ['new', 'working']

/** RF-4.1: prioridade alta→baixa; empate por prazo mais próximo; sem prazo por último. Cópia (não muta). */
export function sortTasks<T extends SortableTask>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    const byPriority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    if (byPriority !== 0) return byPriority
    if (a.due_date === b.due_date) return 0
    if (a.due_date === null) return 1
    if (b.due_date === null) return -1
    return a.due_date < b.due_date ? -1 : 1
  })
}

/** RF-4.3: abertas (new/working) primeiro; encerradas (done/canceled) numa seção ao final. */
export function partitionByStatus<T extends { status: Status }>(
  tasks: readonly T[],
): { open: T[]; closed: T[] } {
  const open: T[] = []
  const closed: T[] = []
  for (const task of tasks) {
    if (OPEN_STATUSES.includes(task.status)) open.push(task)
    else closed.push(task)
  }
  return { open, closed }
}
