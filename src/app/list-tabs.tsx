import Link from 'next/link'
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
      <Link href="/" aria-current={activeListId === null ? 'page' : undefined}>
        Todas
      </Link>
      {lists.map((list) => (
        <Link
          key={list.id}
          href={`/?list=${list.id}`}
          aria-current={activeListId === list.id ? 'page' : undefined}
        >
          {list.name}
        </Link>
      ))}
      <NewList />
    </nav>
  )
}
