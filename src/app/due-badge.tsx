import { classifyDueDate, DUE_CLASS_LABELS } from '@/domain/task'

/**
 * Badge de vencimento (RF-4.2/RF-5.2). Hoje/Atrasada recebem cor semântica
 * dessaturada E rótulo textual (acessível sem cor); futuras em texto secundário.
 * Sem prazo → nada.
 */
export function DueBadge({ dueDate, today }: { dueDate: string | null; today: string }) {
  const cls = classifyDueDate(dueDate, today)
  if (cls === null) return null

  const color =
    cls === 'overdue'
      ? 'var(--due-overdue)'
      : cls === 'today'
        ? 'var(--due-today)'
        : 'var(--muted)'
  const prefix = cls === 'future' ? '' : `${DUE_CLASS_LABELS[cls]} · `

  return (
    <small style={{ color }}>
      ({prefix}
      {dueDate})
    </small>
  )
}
