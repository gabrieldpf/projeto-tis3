// Dados mockados remanescentes do protótipo.
// A partir da Sprint 2, clientes, veículos, orçamentos e OS vêm da API real.
// O FINANCEIRO continua mockado de propósito: está fora de escopo e é restrito
// ao admin (regra de ouro nº 2) — será tratado numa sprint futura.

// --- Indicadores financeiros (SOMENTE ADMIN — regra de ouro nº 2) ------------
export const financeiro = {
  faturamentoMes: 48250.0,
  faturamentoMesAnterior: 41900.0,
  ticketMedio: 620.0,
  aReceber: 7300.0,
  // série de carros x faturamento por período (relatório restrito ao admin)
  serie: [
    { periodo: 'Mai', carros: 232, faturamento: 39800 },
    { periodo: 'Jun', carros: 248, faturamento: 43100 },
    { periodo: 'Jul', carros: 265, faturamento: 41900 },
    { periodo: 'Ago', carros: 258, faturamento: 45600 },
    { periodo: 'Set', carros: 96, faturamento: 48250 },
  ],
}
