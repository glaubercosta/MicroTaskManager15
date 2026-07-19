import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type TestUser = { id: string; email: string; client: SupabaseClient }

async function makeUser(): Promise<TestUser> {
  const email = `rls-${crypto.randomUUID()}@test.local`
  const password = 'test-password-123'
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return { id: data.user!.id, email, client }
}

describe('RLS de tasks: isolamento entre usuários (RNF-1)', () => {
  let userA: TestUser
  let userB: TestUser
  let taskAId: string

  beforeAll(async () => {
    userA = await makeUser()
    userB = await makeUser()

    const { data, error } = await userA.client
      .from('tasks')
      .insert({ user_id: userA.id, title: 'Tarefa privada de A' })
      .select('id')
      .single()
    if (error) throw error
    taskAId = data.id
  })

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id)
    if (userB) await admin.auth.admin.deleteUser(userB.id)
  })

  it('B não enxerga tarefas de A no SELECT', async () => {
    const { data: seenByB, error: errB } = await userB.client.from('tasks').select('id')
    expect(errB).toBeNull()
    expect(seenByB ?? []).toHaveLength(0)

    const { data: seenByA, error: errA } = await userA.client.from('tasks').select('id')
    expect(errA).toBeNull()
    expect((seenByA ?? []).map((r) => r.id)).toContain(taskAId)
  })

  it('B não consegue apagar tarefa de A (RLS filtra; A ainda vê)', async () => {
    await userB.client.from('tasks').delete().eq('id', taskAId)

    const { data: stillThere } = await userA.client.from('tasks').select('id').eq('id', taskAId)
    expect(stillThere ?? []).toHaveLength(1)
  })

  it('B não consegue inserir linha com user_id de A (with check)', async () => {
    const { error } = await userB.client
      .from('tasks')
      .insert({ user_id: userA.id, title: 'Injeção de B' })
    expect(error).not.toBeNull()
  })
})
