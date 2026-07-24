import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn(() => ({ insert })),
  })),
}))
vi.mock('@/lib/supabase/list-ownership', () => ({ userOwnsList: vi.fn() }))

import { createTask } from './actions'
import { userOwnsList } from '@/lib/supabase/list-ownership'

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('createTask valida posse do list_id (GC-21)', () => {
  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ error: null })
    vi.mocked(userOwnsList).mockReset()
  })

  it('lista alheia/inexistente → erro de validação, sem insert', async () => {
    vi.mocked(userOwnsList).mockResolvedValue(false)
    const result = await createTask(null, form({ title: 'Tarefa', list_id: 'uuid-de-outro' }))
    expect(result).toEqual({ error: 'Lista inválida.' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('lista própria → cria a task com o list_id', async () => {
    vi.mocked(userOwnsList).mockResolvedValue(true)
    const result = await createTask(null, form({ title: 'Tarefa', list_id: 'uuid-proprio' }))
    expect(result).toEqual({ error: null })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ list_id: 'uuid-proprio', title: 'Tarefa' }),
    )
  })

  it('sem lista ("all"/vazio) → não consulta posse e cria com list_id null', async () => {
    const result = await createTask(null, form({ title: 'Tarefa', list_id: 'all' }))
    expect(result).toEqual({ error: null })
    expect(userOwnsList).not.toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ list_id: null }))
  })
})
