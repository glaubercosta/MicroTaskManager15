import { describe, it, expect } from 'vitest'
import {
  validateTitle,
  isPriority,
  isStatus,
  normalizeDueDate,
  PRIORITIES,
  STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
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
    expect(PRIORITY_LABELS.high).toBe('Alta')
    expect(STATUS_LABELS.working).toBe('Trabalhando')
    expect(STATUS_LABELS.done).toBe('Concluída')
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
