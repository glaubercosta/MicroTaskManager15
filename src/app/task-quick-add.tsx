'use client'

import { useActionState } from 'react'
import { createTask } from './actions'
import { PRIORITIES, PRIORITY_LABELS } from '@/domain/task'
import { ALL_LISTS } from '@/domain/list'

export function TaskQuickAdd({ activeListId }: { activeListId: string | null }) {
  const [state, formAction, pending] = useActionState(createTask, { error: null })

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
      <input type="hidden" name="list_id" defaultValue={activeListId ?? ALL_LISTS} />
      <input name="title" placeholder="Adicionar tarefa…" aria-label="Título da tarefa" required />
      <select name="priority" defaultValue="medium" aria-label="Prioridade">
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </select>
      <input name="due_date" type="date" aria-label="Prazo" />
      <button type="submit" disabled={pending}>
        {pending ? 'Adicionando…' : 'Adicionar'}
      </button>
      {state?.error ? <p role="alert">{state.error}</p> : null}
    </form>
  )
}
