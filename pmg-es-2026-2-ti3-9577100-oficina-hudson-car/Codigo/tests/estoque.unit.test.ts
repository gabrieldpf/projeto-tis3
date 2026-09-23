// Testes unitários puros da regra de saldo (sem banco).
import { describe, it, expect } from 'vitest'
import { calcularNovoSaldo } from '@/server/estoque'
import { ApiError } from '@/lib/http'

describe('calcularNovoSaldo', () => {
  it('ENTRADA soma ao saldo', () => {
    expect(calcularNovoSaldo(10, 'ENTRADA', 5)).toBe(15)
  })

  it('SAIDA subtrai do saldo', () => {
    expect(calcularNovoSaldo(10, 'SAIDA', 4)).toBe(6)
  })

  it('SAIDA até zerar é permitida', () => {
    expect(calcularNovoSaldo(4, 'SAIDA', 4)).toBe(0)
  })

  it('SAIDA que deixaria saldo negativo é bloqueada (exige AJUSTE)', () => {
    expect(() => calcularNovoSaldo(3, 'SAIDA', 5)).toThrow(ApiError)
  })

  it('AJUSTE define o saldo para o valor informado (não soma)', () => {
    expect(calcularNovoSaldo(999, 'AJUSTE', 12)).toBe(12)
  })
})
