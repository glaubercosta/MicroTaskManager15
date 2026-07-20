import type { List } from '@/domain/list'
import { NewList } from './new-list'

/** RF-2.2: pílulas "Todas" + uma por lista + "＋ Nova lista". Aba ativa via aria-current. */
export function ListTabs({
  lists,
  activeListId,
}: {
  lists: List[]
  activeListId: string | null
}) {
  return (
    <nav aria-label="Listas" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plain <a>: server re-render via ?list=, sem router client (ver contexto da task) */}
      <a href="/" aria-current={activeListId === null ? 'page' : undefined}>
        Todas
      </a>
      {lists.map((list) => (
        <a
          key={list.id}
          href={`/?list=${list.id}`}
          aria-current={activeListId === list.id ? 'page' : undefined}
        >
          {list.name}
        </a>
      ))}
      <NewList />
    </nav>
  )
}
