import { describe, it, expect } from 'vitest'
import { validateTitle } from './task'

describe('validateTitle', () => {
  it('retorna o título aparado quando válido', () => {
    expect(validateTitle('  Comprar café  ')).toBe('Comprar café')
  })

  it('rejeita título vazio ou só com espaços', () => {
    expect(() => validateTitle('   ')).toThrow('vazio')
  })
})
