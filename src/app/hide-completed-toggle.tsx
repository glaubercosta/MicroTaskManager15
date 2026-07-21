import Link from 'next/link'
import { HIDE_DONE_PARAM, HIDE_DONE_VALUE } from '@/domain/task'

/**
 * Alterna `?done=hidden` preservando `?list=` (RF-4.4). Estado na URL: server-rendered
 * e sobrevive a reload, coerente com as abas por `?list=` (GC-d).
 */
export function HideCompletedToggle({
  hideCompleted,
  activeListId,
}: {
  hideCompleted: boolean
  activeListId: string | null
}) {
  // `resolveActiveListId` já devolve `null` (aba "Todas") ou um id real — nunca o
  // sentinela "all". Só propagamos `?list=` quando há um id real.
  const query: Record<string, string> = {}
  if (activeListId !== null) query.list = activeListId
  if (!hideCompleted) query[HIDE_DONE_PARAM] = HIDE_DONE_VALUE
  // quando já está oculto, o link volta a mostrar (sem o param `done`).

  return (
    <Link href={{ pathname: '/', query }} aria-pressed={hideCompleted}>
      {hideCompleted ? 'Mostrar concluídas' : 'Ocultar concluídas'}
    </Link>
  )
}
