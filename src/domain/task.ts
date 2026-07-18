/** Valida e normaliza o título de uma tarefa (RF-3.2). Lança se vazio. */
export function validateTitle(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new Error('O título da tarefa não pode ser vazio.')
  }
  return trimmed
}
