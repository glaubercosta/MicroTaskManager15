'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { validateTitle, isPriority, isStatus, normalizeDueDate } from '@/domain/task'

async function requireUserClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

/** RF-3.1: título obrigatório; prioridade default medium; prazo opcional; status inicial 'new'. */
export async function createTask(_prev: unknown, formData: FormData) {
  let title: string
  try {
    title = validateTitle(String(formData.get('title') ?? ''))
  } catch (e) {
    return { error: (e as Error).message }
  }

  const rawPriority = String(formData.get('priority') ?? 'medium')
  const priority = isPriority(rawPriority) ? rawPriority : 'medium'

  let due_date: string | null
  try {
    due_date = normalizeDueDate(String(formData.get('due_date') ?? ''))
  } catch (e) {
    return { error: (e as Error).message }
  }

  const { supabase, user } = await requireUserClient()
  const { error } = await supabase
    .from('tasks')
    .insert({ user_id: user.id, title, priority, due_date, status: 'new' })
  if (error) return { error: 'Não foi possível criar a tarefa.' }

  revalidatePath('/')
  return { error: null }
}

/** RF-3.2: editar título (rejeita vazio). */
export async function updateTaskTitle(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  let title: string
  try {
    title = validateTitle(String(formData.get('title') ?? ''))
  } catch {
    return
  }
  const { supabase } = await requireUserClient()
  await supabase.from('tasks').update({ title }).eq('id', id)
  revalidatePath('/')
}

/** RF-3.3: mudar prioridade. */
export async function setTaskPriority(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const raw = String(formData.get('priority') ?? '')
  if (!isPriority(raw)) return
  const { supabase } = await requireUserClient()
  await supabase.from('tasks').update({ priority: raw }).eq('id', id)
  revalidatePath('/')
}

/** RF-3.4: definir ou limpar prazo. */
export async function setTaskDueDate(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  let due_date: string | null
  try {
    due_date = normalizeDueDate(String(formData.get('due_date') ?? ''))
  } catch {
    return
  }
  const { supabase } = await requireUserClient()
  await supabase.from('tasks').update({ due_date }).eq('id', id)
  revalidatePath('/')
}

/** RF-3.5: mudar status (nova/trabalhando/concluída/cancelada). */
export async function setTaskStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const raw = String(formData.get('status') ?? '')
  if (!isStatus(raw)) return
  const { supabase } = await requireUserClient()
  await supabase.from('tasks').update({ status: raw }).eq('id', id)
  revalidatePath('/')
}

/** RF-3.6: apagar tarefa. */
export async function deleteTask(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const { supabase } = await requireUserClient()
  await supabase.from('tasks').delete().eq('id', id)
  revalidatePath('/')
}
