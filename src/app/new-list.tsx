'use client'

import { useActionState } from 'react'
import { createList } from './actions'

export function NewList() {
  const [state, formAction, pending] = useActionState(createList, { error: null })

  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input
        name="name"
        placeholder="＋ Nova lista"
        aria-label="Nome da nova lista"
        required
      />
      <button type="submit" disabled={pending}>
        {pending ? 'Criando…' : 'Criar'}
      </button>
      {state?.error ? <span role="alert">{state.error}</span> : null}
    </form>
  )
}
