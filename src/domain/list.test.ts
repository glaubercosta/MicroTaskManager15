import { describe, it, expect } from 'vitest'
import {
  validateListName,
  normalizeListId,
  resolveActiveListId,
  filterTasksByList,
} from './list'

describe('validateListName (RF-2.1)', () => {
  it('faz trim e retorna o nome', () => {
    expect(validateListName('  Trabalho  ')).toBe('Trabalho')
  })
  it('rejeita vazio ou só espaços', () => {
    expect(() => validateListName('   ')).toThrow(/vazio/i)
    expect(() => validateListName('')).toThrow(/vazio/i)
  })
})

describe('normalizeListId', () => {
  it('vazio, espaços e "all" viram null (aba Todas)', () => {
    expect(normalizeListId('')).toBeNull()
    expect(normalizeListId('   ')).toBeNull()
    expect(normalizeListId('all')).toBeNull()
  })
  it('um id concreto é preservado (trim)', () => {
    expect(normalizeListId('  abc-123  ')).toBe('abc-123')
  })
})

describe('resolveActiveListId', () => {
  const lists = [{ id: 'l1' }, { id: 'l2' }]
  it('sem param ou "all" → null (Todas)', () => {
    expect(resolveActiveListId(lists, undefined)).toBeNull()
    expect(resolveActiveListId(lists, 'all')).toBeNull()
  })
  it('id existente é aceito', () => {
    expect(resolveActiveListId(lists, 'l2')).toBe('l2')
  })
  it('id inexistente cai para Todas (null)', () => {
    expect(resolveActiveListId(lists, 'fantasma')).toBeNull()
  })
})

describe('filterTasksByList (RF-2.3)', () => {
  const tasks = [
    { id: 't1', list_id: null },
    { id: 't2', list_id: 'l1' },
    { id: 't3', list_id: 'l2' },
    { id: 't4', list_id: 'l1' },
  ]
  it('Todas (null) mostra tudo (cópia, não muta)', () => {
    const out = filterTasksByList(tasks, null)
    expect(out.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4'])
    expect(out).not.toBe(tasks)
  })
  it('lista ativa mostra só as tarefas daquela lista', () => {
    expect(filterTasksByList(tasks, 'l1').map((t) => t.id)).toEqual(['t2', 't4'])
  })
  it('tarefas sem lista não aparecem numa lista específica', () => {
    expect(filterTasksByList(tasks, 'l2').map((t) => t.id)).toEqual(['t3'])
  })
})
