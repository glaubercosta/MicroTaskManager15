import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { userOwnsList } from './list-ownership'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type TestUser = { id: string; email: string; client: SupabaseClient }

async function makeUser(): Promise<TestUser> {
  const email = `own-${crypto.randomUUID()}@test.local`
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

describe('userOwnsList sob RLS (GC-21)', () => {
  let userA: TestUser
  let userB: TestUser
  let listAId: string

  beforeAll(async () => {
    userA = await makeUser()
    userB = await makeUser()

    const { data, error } = await userA.client
      .from('lists')
      .insert({ user_id: userA.id, name: 'Lista de A' })
      .select('id')
      .single()
    if (error) throw error
    listAId = data.id
  })

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id)
    if (userB) await admin.auth.admin.deleteUser(userB.id)
  })

  it('dono da lista → true (fluxo normal intacto)', async () => {
    expect(await userOwnsList(userA.client, listAId)).toBe(true)
  })

  it('lista de outro usuário → false (RLS esconde a linha)', async () => {
    expect(await userOwnsList(userB.client, listAId)).toBe(false)
  })

  it('id inexistente → false', async () => {
    expect(await userOwnsList(userA.client, crypto.randomUUID())).toBe(false)
  })

  it('id malformado → false (erro do banco tratado)', async () => {
    expect(await userOwnsList(userA.client, 'não-é-uuid')).toBe(false)
  })
})
