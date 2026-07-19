import { describe, it, expect } from 'vitest'
import {
  validateTitle,
  isPriority,
  isStatus,
  normalizeDueDate,
  sortTasks,
  partitionByStatus,
  PRIORITIES,
  STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Priority,
  type Status,
} from './task'

describe('validateTitle', () => {
  it('retorna o título aparado quando válido', () => {
    expect(validateTitle('  Comprar café  ')).toBe('Comprar café')
  })

  it('rejeita título vazio ou só com espaços', () => {
    expect(() => validateTitle('   ')).toThrow('vazio')
  })
})

describe('guards de enum', () => {
  it('isPriority aceita valores válidos e rejeita inválidos', () => {
    expect(PRIORITIES).toEqual(['low', 'medium', 'high'])
    expect(isPriority('high')).toBe(true)
    expect(isPriority('urgent')).toBe(false)
  })

  it('isStatus aceita valores válidos e rejeita inválidos', () => {
    expect(STATUSES).toEqual(['new', 'working', 'done', 'canceled'])
    expect(isStatus('working')).toBe(true)
    expect(isStatus('pending')).toBe(false)
  })

  it('rótulos pt-BR cobrem todos os valores internos (RNF-4)', () => {
    PRIORITIES.forEach((p) => expect(PRIORITY_LABELS[p]).toBeTruthy())
    STATUSES.forEach((s) => expect(STATUS_LABELS[s]).toBeTruthy())
    // spot-check de tradução
    expect(PRIORITY_LABELS.high).toBe('Alta')
    expect(STATUS_LABELS.working).toBe('Trabalhando')
  })
})

describe('normalizeDueDate', () => {
  it('string vazia ou só espaços vira null (limpar prazo)', () => {
    expect(normalizeDueDate('')).toBeNull()
    expect(normalizeDueDate('   ')).toBeNull()
  })

  it('aceita AAAA-MM-DD válido', () => {
    expect(normalizeDueDate('2026-07-19')).toBe('2026-07-19')
  })

  it('rejeita formato inválido', () => {
    expect(() => normalizeDueDate('19/07/2026')).toThrow('inválido')
  })
})

const t = (priority: Priority, due_date: string | null, status: Status = 'new') => ({
  priority,
  due_date,
  status,
})

describe('sortTasks (RF-4.1)', () => {
  it('ordena por prioridade alta→baixa', () => {
    const out = sortTasks([t('low', null), t('high', null), t('medium', null)])
    expect(out.map((x) => x.priority)).toEqual(['high', 'medium', 'low'])
  })

  it('no empate de prioridade, prazo mais próximo primeiro', () => {
    const out = sortTasks([t('high', '2026-08-10'), t('high', '2026-08-01')])
    expect(out.map((x) => x.due_date)).toEqual(['2026-08-01', '2026-08-10'])
  })

  it('sem prazo vai depois das com prazo, na mesma prioridade', () => {
    const out = sortTasks([t('high', null), t('high', '2026-08-01')])
    expect(out.map((x) => x.due_date)).toEqual(['2026-08-01', null])
  })

  it('não muta o array de entrada', () => {
    const input = [t('low', null), t('high', null)]
    const copy = [...input]
    sortTasks(input)
    expect(input).toEqual(copy)
  })
})

describe('partitionByStatus (RF-4.3)', () => {
  it('separa abertas (new/working) das encerradas (done/canceled) preservando a ordem', () => {
    const list = [
      t('high', null, 'new'),
      t('high', null, 'done'),
      t('high', null, 'working'),
      t('high', null, 'canceled'),
    ]
    const { open, closed } = partitionByStatus(list)
    expect(open.map((x) => x.status)).toEqual(['new', 'working'])
    expect(closed.map((x) => x.status)).toEqual(['done', 'canceled'])
  })
})
