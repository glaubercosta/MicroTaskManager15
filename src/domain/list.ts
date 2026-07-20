/** Valida e normaliza o nome de uma lista (RF-2.1). Lança se vazio. */
export function validateListName(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new Error('O nome da lista não pode ser vazio.')
  }
  return trimmed
}

/** Linha de lista como vem do banco. */
export interface List {
  id: string
  name: string
  created_at: string
}

/** Sentinela da aba fixa "Todas" na URL. */
export const ALL_LISTS = 'all' as const

/**
 * Normaliza o `list_id` vindo de formulário. Vazio, espaços ou "all" → null
 * (tarefa sem lista / aba "Todas"). Caso contrário, o id (com trim).
 */
export function normalizeListId(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed === ALL_LISTS) return null
  return trimmed
}

/**
 * Resolve a lista ativa a partir do parâmetro de URL. Sem param ou "all" → null
 * (aba "Todas"). Um id só é aceito se pertencer às listas do usuário; caso
 * contrário cai para "Todas" (null) — evita filtrar por lista inexistente/alheia.
 */
export function resolveActiveListId(
  lists: readonly { id: string }[],
  param: string | undefined,
): string | null {
  if (!param || param === ALL_LISTS) return null
  return lists.some((l) => l.id === param) ? param : null
}

/** RF-2.3: "Todas" (null) mostra tudo; uma lista ativa filtra por `list_id`. Cópia (não muta). */
export function filterTasksByList<T extends { list_id: string | null }>(
  tasks: readonly T[],
  activeListId: string | null,
): T[] {
  if (activeListId === null) return [...tasks]
  return tasks.filter((t) => t.list_id === activeListId)
}
