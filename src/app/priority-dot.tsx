import { PRIORITY_LABELS, type Priority } from '@/domain/task'

/** Pontinho de prioridade com rótulo textual (RF-4.2): acessível sem depender de cor. */
export function PriorityDot({ priority }: { priority: Priority }) {
  const label = PRIORITY_LABELS[priority]
  return (
    <span aria-label={`Prioridade: ${label}`} title={label}>
      ●
    </span>
  )
}
