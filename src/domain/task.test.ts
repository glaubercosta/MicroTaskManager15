import { describe, it, expect } from 'vitest'
import {
  validateTitle,
  isPriority,
  isStatus,
  normalizeDueDate,
  sortTasks,
  partitionByStatus,
  classifyDueDate,
  DUE_CLASS_LABELS,
  todayISO,
  buildTaskView,
  HIDE_DONE_PARAM,
  parseHideDone,
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

  it('prioridade domina o desempate por prazo', () => {
    const out = sortTasks([t('low', '2026-08-01'), t('high', '2026-08-31')])
    expect(out.map((x) => x.priority)).toEqual(['high', 'low'])
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

  it('preserva a ordem relativa dentro de cada seção com múltiplas tarefas do mesmo status', () => {
    const list = [
      t('high', '2026-08-01', 'new'),
      t('high', '2026-08-02', 'done'),
      t('high', '2026-08-03', 'working'),
      t('high', '2026-08-04', 'canceled'),
    ]
    const { open, closed } = partitionByStatus(list)
    expect(open.map((x) => x.due_date)).toEqual(['2026-08-01', '2026-08-03'])
    expect(closed.map((x) => x.due_date)).toEqual(['2026-08-02', '2026-08-04'])
  })
})

describe('classifyDueDate (RF-5.1)', () => {
  const TODAY = '2026-07-21'

  it('sem prazo → null (sem indicação)', () => {
    expect(classifyDueDate(null, TODAY)).toBeNull()
  })

  it('prazo anterior a hoje → overdue', () => {
    expect(classifyDueDate('2026-07-20', TODAY)).toBe('overdue')
  })

  it('prazo igual a hoje → today', () => {
    expect(classifyDueDate('2026-07-21', TODAY)).toBe('today')
  })

  it('prazo posterior a hoje → future', () => {
    expect(classifyDueDate('2026-07-22', TODAY)).toBe('future')
  })

  it('classifica corretamente na virada de mês (RF-5.1)', () => {
    expect(classifyDueDate('2026-08-01', '2026-07-31')).toBe('future')
    expect(classifyDueDate('2026-07-31', '2026-08-01')).toBe('overdue')
  })

  it('rótulos pt-BR cobrem todas as classes', () => {
    expect(DUE_CLASS_LABELS.overdue).toBe('Atrasada')
    expect(DUE_CLASS_LABELS.today).toBe('Hoje')
    expect(DUE_CLASS_LABELS.future).toBe('Futura')
  })
})

describe('buildTaskView (RF-4.3/4.4/4.5)', () => {
  const sample = () => [
    t('low', null, 'new'),
    t('high', '2026-08-01', 'done'),
    t('medium', null, 'working'),
  ]

  it('ordena e particiona: abertas ordenadas por prioridade, concluídas ao final', () => {
    const view = buildTaskView(sample(), { hideCompleted: false })
    expect(view.open.map((x) => x.priority)).toEqual(['medium', 'low'])
    expect(view.closed.map((x) => x.status)).toEqual(['done'])
    expect(view.closedCount).toBe(1)
  })

  it('openCount conta só as abertas (RF-4.5)', () => {
    const view = buildTaskView(sample(), { hideCompleted: false })
    expect(view.openCount).toBe(2)
  })

  it('hideCompleted=true zera a seção de concluídas mas mantém a contagem de abertas (RF-4.4)', () => {
    const view = buildTaskView(sample(), { hideCompleted: true })
    expect(view.closed).toEqual([])
    expect(view.closedCount).toBe(1)
    expect(view.open).toHaveLength(2)
    expect(view.openCount).toBe(2)
  })

  it('lista vazia → tudo vazio e contagem zero', () => {
    const view = buildTaskView([], { hideCompleted: false })
    expect(view).toEqual({ open: [], closed: [], openCount: 0, closedCount: 0 })
  })

  it('não muta o array de entrada', () => {
    const input = sample()
    const copy = [...input]
    buildTaskView(input, { hideCompleted: true })
    expect(input).toEqual(copy)
  })
})

describe('todayISO (RF-5)', () => {
  it('usa o fuso de São Paulo: 23:30Z ainda é o mesmo dia local', () => {
    // 2026-07-21T23:30:00Z → SP 20:30 do dia 21
    expect(todayISO('America/Sao_Paulo', new Date('2026-07-21T23:30:00Z'))).toBe('2026-07-21')
  })

  it('vira o dia pelo horário local, não pelo UTC', () => {
    // 2026-07-22T02:00:00Z → SP 23:00 ainda do dia 21 (UTC já é dia 22)
    expect(todayISO('America/Sao_Paulo', new Date('2026-07-22T02:00:00Z'))).toBe('2026-07-21')
  })

  it('produz o formato AAAA-MM-DD', () => {
    expect(todayISO('America/Sao_Paulo', new Date('2026-01-05T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('parseHideDone (RF-4.4)', () => {
  it('o nome do param é estável', () => {
    expect(HIDE_DONE_PARAM).toBe('done')
  })

  it('"hidden" → true', () => {
    expect(parseHideDone('hidden')).toBe(true)
  })

  it('ausente/undefined ou qualquer outro valor → false (mostrar concluídas por padrão)', () => {
    expect(parseHideDone(undefined)).toBe(false)
    expect(parseHideDone('')).toBe(false)
    expect(parseHideDone('shown')).toBe(false)
  })

  it('aceita array de query params usando o primeiro valor', () => {
    expect(parseHideDone(['hidden', 'shown'])).toBe(true)
  })
})
