import { createClient } from '@/lib/supabase/server'
import { signOut } from './login/actions'
import {
  sortTasks,
  partitionByStatus,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Task,
} from '@/domain/task'
import {
  filterTasksByList,
  resolveActiveListId,
  ALL_LISTS,
  type List,
} from '@/domain/list'
import { TaskQuickAdd } from './task-quick-add'
import { ListTabs } from './list-tabs'
import {
  updateTaskTitle,
  setTaskPriority,
  setTaskDueDate,
  setTaskStatus,
  deleteTask,
} from './actions'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ list?: string | string[] }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: listsData } = await supabase
    .from('lists')
    .select('id,name,created_at')
    .order('created_at', { ascending: true })
  const lists = (listsData ?? []) as List[]

  const { list: rawParam } = await searchParams
  const listParam = Array.isArray(rawParam) ? rawParam[0] : rawParam
  const activeListId = resolveActiveListId(lists, listParam)

  const { data } = await supabase
    .from('tasks')
    .select('id,title,priority,due_date,status,list_id,created_at')
  const allTasks = (data ?? []) as Task[]
  const tasks = filterTasksByList(allTasks, activeListId)
  const { open, closed } = partitionByStatus(sortTasks(tasks))

  return (
    <main style={{ maxWidth: 600, margin: '6vh auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>MicroTaskManager</h1>
        <form action={signOut}>
          <button type="submit">Sair</button>
        </form>
      </header>
      <p>Sessão de {user?.email ?? 'desconhecido'}.</p>

      <ListTabs lists={lists} activeListId={activeListId} />

      {lists.length === 0 ? (
        <p role="note">Você ainda não tem listas. Crie a primeira acima para organizar suas tarefas.</p>
      ) : null}

      <TaskQuickAdd key={activeListId ?? ALL_LISTS} activeListId={activeListId} />

      <section aria-label="Tarefas abertas">
        <h2>Abertas ({open.length})</h2>
        <ul>
          {open.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      </section>

      {closed.length > 0 ? (
        <section aria-label="Concluídas">
          <h2>Concluídas</h2>
          <ul>
            {closed.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}

function TaskRow({ task }: { task: Task }) {
  const done = task.status === 'done' || task.status === 'canceled'

  return (
    <li style={{ marginBottom: 12 }}>
      <span aria-label={`Prioridade: ${PRIORITY_LABELS[task.priority]}`} title={PRIORITY_LABELS[task.priority]}>
        ●
      </span>{' '}
      <span style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
        {task.title}
      </span>{' '}
      {task.due_date ? <small>({task.due_date})</small> : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <form action={updateTaskTitle}>
          <input type="hidden" name="id" defaultValue={task.id} />
          <input name="title" defaultValue={task.title} aria-label={`Editar título de ${task.title}`} />
          <button type="submit" aria-label={`Salvar título de ${task.title}`}>
            Salvar
          </button>
        </form>

        <form action={setTaskPriority}>
          <input type="hidden" name="id" defaultValue={task.id} />
          <select key={task.priority} name="priority" defaultValue={task.priority} aria-label={`Prioridade de ${task.title}`}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <button type="submit" aria-label={`Aplicar prioridade de ${task.title}`}>
            Prioridade
          </button>
        </form>

        <form action={setTaskStatus}>
          <input type="hidden" name="id" defaultValue={task.id} />
          <select key={task.status} name="status" defaultValue={task.status} aria-label={`Status de ${task.title}`}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button type="submit" aria-label={`Aplicar status de ${task.title}`}>
            Status
          </button>
        </form>

        <form action={setTaskDueDate}>
          <input type="hidden" name="id" defaultValue={task.id} />
          <input name="due_date" type="date" defaultValue={task.due_date ?? ''} aria-label={`Prazo de ${task.title}`} />
          <button type="submit" aria-label={`Aplicar prazo de ${task.title}`}>
            Prazo
          </button>
        </form>

        <form action={deleteTask}>
          <input type="hidden" name="id" defaultValue={task.id} />
          <button type="submit" aria-label={`Apagar ${task.title}`}>
            Apagar
          </button>
        </form>
      </div>
    </li>
  )
}
