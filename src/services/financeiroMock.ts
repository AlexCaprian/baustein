// Dados mockados do módulo Financeiro (ainda sem endpoints no backend).
// Paleta de status segue o mesmo padrão { bg, bgDark, text } usado em
// PERFIL_COLORS (funcionarios.tsx) e nas colunas Extras/Atraso/Banco H. (ponto.tsx).

export interface StatusColor {
  bg: string;
  bgDark: string;
  text: string;
}

export const STATUS_COLORS: Record<string, StatusColor> = {
  // positivo / concluído
  pago: { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },
  sucesso: { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },
  concluido: { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },
  emitida: { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },

  // pendente / em andamento
  pendente: { bg: '#fefce8', bgDark: '#3b2a05', text: '#ca8a04' },
  processando: { bg: '#eff6ff', bgDark: '#1e3a5f', text: '#3b5fe0' },

  // atrasado / erro / cancelado
  atrasado: { bg: '#fef2f2', bgDark: '#7f1d1d', text: '#dc2626' },
  erro: { bg: '#fef2f2', bgDark: '#7f1d1d', text: '#dc2626' },
  cancelada: { bg: '#fef2f2', bgDark: '#7f1d1d', text: '#dc2626' },
};

// ─── Mapeamento Tailwind: LancamentoFinanceiro.status → <Badge /> (PASSO 4) ──
// <Badge label={...} color={STATUS_COLORS[l.status]} isDark={isDark} /> aplica
// STATUS_COLORS via style inline, equivalente visual às classes Tailwind do
// mesmo padrão já homologado na tela de Ponto:
//   status === 'pago'     -> bg-green-50  dark:bg-green-950  text-green-600  (sucesso)
//   status === 'pendente' -> bg-yellow-50 dark:bg-yellow-950 text-yellow-600 (atenção)
//   status === 'atrasado' -> bg-red-50    dark:bg-red-950    text-red-600    (alerta)
// Como os 3 valores de status são compartilhados por todo o módulo, o mesmo
// <Badge> usado em Contas a Pagar/Receber serve para Fluxo de Caixa e DRE.

export const TIPO_LANCAMENTO_COLORS: Record<'pagar' | 'receber', StatusColor> = {
  receber: { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },
  pagar: { bg: '#fef2f2', bgDark: '#7f1d1d', text: '#dc2626' },
};

export const TIPO_TRANSACAO_COLORS: Record<'credito' | 'debito', StatusColor> = {
  credito: { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },
  debito: { bg: '#fef2f2', bgDark: '#7f1d1d', text: '#dc2626' },
};

// ─── 1. Gerar relatórios ───────────────────────────────────────────────────

export interface ModeloRelatorio {
  id: number;
  titulo: string;
  descricao: string;
  formatoDisponivel: string[];
}

export const dadosModelosRelatorio: ModeloRelatorio[] = [
  { id: 1, titulo: 'DRE Mensal', descricao: 'Demonstrativo de resultado consolidado do mês.', formatoDisponivel: ['PDF', 'XLSX'] },
  { id: 2, titulo: 'Fluxo de Caixa', descricao: 'Entradas, saídas e saldo projetado por período.', formatoDisponivel: ['PDF', 'XLSX', 'CSV'] },
  { id: 3, titulo: 'Contas a Pagar', descricao: 'Lançamentos em aberto e vencidos por fornecedor.', formatoDisponivel: ['PDF', 'XLSX'] },
  { id: 4, titulo: 'Contas a Receber', descricao: 'Recebíveis em aberto e atrasados por cliente.', formatoDisponivel: ['PDF', 'XLSX'] },
  { id: 5, titulo: 'Conciliação Bancária', descricao: 'Comparativo entre extrato bancário e lançamentos internos.', formatoDisponivel: ['XLSX', 'CSV'] },
];

export interface RelatorioGerado {
  id: number;
  nome: string;
  dataGeracao: string; // YYYY-MM-DD
  tamanho: string;
  status: 'concluido' | 'processando' | 'erro';
}

export const dadosHistoricoRelatorios: RelatorioGerado[] = [
  { id: 1, nome: 'DRE Mensal - Maio 2026', dataGeracao: '2026-06-01', tamanho: '1.2 MB', status: 'concluido' },
  { id: 2, nome: 'Fluxo de Caixa - Maio 2026', dataGeracao: '2026-06-01', tamanho: '845 KB', status: 'concluido' },
  { id: 3, nome: 'Contas a Pagar - Junho 2026', dataGeracao: '2026-06-10', tamanho: '512 KB', status: 'concluido' },
  { id: 4, nome: 'Contas a Receber - Junho 2026', dataGeracao: '2026-06-12', tamanho: '—', status: 'processando' },
  { id: 5, nome: 'Conciliação Bancária - Maio 2026', dataGeracao: '2026-05-31', tamanho: '—', status: 'erro' },
];

// ─── 2. Plano de contas (categorias financeiras / DRE) ─────────────────────
// Referenciado por LancamentoFinanceiro.categoriaId. O campo `nivel` define a
// indentação visual no DRE — NotasDRESection já usa exatamente esse padrão
// (paddingHorizontal: 14 + item.nivel * 20), ou seja:
//   nivel 0 -> ~14px de recuo (grupo, negrito)
//   nivel 1 -> ~34px de recuo (subgrupo)
//   nivel 2 -> ~54px de recuo (detalhe)
// Em Tailwind isso equivale a aplicar pl-3.5 / pl-8.5 / pl-13.5 por nivel.

export interface CategoriaFinanceira {
  id: number;
  codigo: string;     // numeração do plano de contas / DRE, ex: '3.1.1'
  nome: string;
  tipo: 'receita' | 'despesa';
  nivel: number;       // 0 = grupo, 1 = subgrupo, 2 = detalhe — indentação no DRE (PASSO 4)
  parentId: number | null;
}

export const dadosCategoriasFinanceiras: CategoriaFinanceira[] = [
  { id: 1, codigo: '3.1', nome: 'Receita Bruta de Vendas e Serviços', tipo: 'receita', nivel: 0, parentId: null },
  { id: 2, codigo: '3.1.1', nome: 'Serviços', tipo: 'receita', nivel: 1, parentId: 1 },
  { id: 3, codigo: '3.1.2', nome: 'Vendas', tipo: 'receita', nivel: 1, parentId: 1 },
  { id: 4, codigo: '3.1.9', nome: 'Outras Receitas', tipo: 'receita', nivel: 1, parentId: 1 },
  { id: 5, codigo: '3.2', nome: 'Deduções e Impostos', tipo: 'despesa', nivel: 0, parentId: null },
  { id: 6, codigo: '3.4', nome: 'Custos Operacionais', tipo: 'despesa', nivel: 0, parentId: null },
  { id: 7, codigo: '3.4.1', nome: 'Pessoal', tipo: 'despesa', nivel: 1, parentId: 6 },
  { id: 8, codigo: '3.4.2', nome: 'Insumos', tipo: 'despesa', nivel: 1, parentId: 6 },
  { id: 9, codigo: '3.5', nome: 'Despesas Administrativas', tipo: 'despesa', nivel: 0, parentId: null },
  { id: 10, codigo: '3.5.1', nome: 'Infraestrutura', tipo: 'despesa', nivel: 1, parentId: 9 },
  { id: 11, codigo: '3.5.2', nome: 'Utilidades', tipo: 'despesa', nivel: 1, parentId: 9 },
  { id: 12, codigo: '3.5.9', nome: 'Outras Despesas', tipo: 'despesa', nivel: 1, parentId: 9 },
];

// ─── 3. Contas a pagar / receber ───────────────────────────────────────────

export interface LancamentoFinanceiro {
  id: number;
  tipo: 'pagar' | 'receber'; // direção do caixa: receber = entrada (+), pagar = saída (-)
  descricao: string;
  categoriaId: number; // FK -> CategoriaFinanceira.id (plano de contas / DRE)
  categoria: string;    // nome da categoria — espelha dadosCategoriasFinanceiras.find(c => c.id === categoriaId)?.nome
  valor: number;
  status: 'pago' | 'pendente' | 'atrasado';
  fornecedorCliente: string;
  dataCompetencia: string;            // YYYY-MM-DD — mês de referência contábil -> alimenta [Notas e DRE]
  dataVencimento: string;             // YYYY-MM-DD -> alimenta [Contas a Pagar/Receber]
  dataPagamento: string | null;       // YYYY-MM-DD | null -> alimenta [Fluxo de Caixa] (regime de caixa)
  conciliado: boolean;                 // -> alimenta [Conciliação Bancária]
  idTransacaoBancaria: string | null; // vincula com TransacaoExtrato.idTransacao
}

// Mesmo registro em estados diferentes (PASSO 3):
//  - id 3: pendente, só com dataVencimento (dataPagamento ainda null).
//  - id 1, 2, 8: pagos, dataPagamento == dataVencimento (caso comum).
//  - id 6, 7: dataCompetencia num mês e dataVencimento/pagamento em outro —
//    entram no DRE do mês de competência mas no Fluxo de Caixa/Contas a
//    Pagar do mês de vencimento.
//  - id 9: pago, mas dataCompetencia (maio) difere de dataPagamento (junho) —
//    o caso clássico que diferencia o DRE (regime de competência) do Fluxo
//    de Caixa (regime de caixa).
export const dadosLancamentos: LancamentoFinanceiro[] = [
  { id: 1, tipo: 'receber', descricao: 'Prestação de serviços - Contrato 042', categoriaId: 2, categoria: 'Serviços', valor: 8500, status: 'pago', fornecedorCliente: 'Construtora Vale Verde', dataCompetencia: '2026-05-28', dataVencimento: '2026-06-05', dataPagamento: '2026-06-05', conciliado: true, idTransacaoBancaria: 'TXN-2026-0605-001' },
  { id: 2, tipo: 'pagar', descricao: 'Aluguel - Galpão Matriz', categoriaId: 10, categoria: 'Infraestrutura', valor: 4200, status: 'pago', fornecedorCliente: 'Imobiliária Santos', dataCompetencia: '2026-06-01', dataVencimento: '2026-06-10', dataPagamento: '2026-06-10', conciliado: true, idTransacaoBancaria: 'TXN-2026-0610-002' },
  { id: 3, tipo: 'pagar', descricao: 'Energia elétrica', categoriaId: 11, categoria: 'Utilidades', valor: 1380.45, status: 'pendente', fornecedorCliente: 'CPFL Energia', dataCompetencia: '2026-06-01', dataVencimento: '2026-06-15', dataPagamento: null, conciliado: false, idTransacaoBancaria: null },
  { id: 4, tipo: 'receber', descricao: 'Venda de materiais - NF 001023', categoriaId: 3, categoria: 'Vendas', valor: 12750, status: 'atrasado', fornecedorCliente: 'Mercado Construir Ltda', dataCompetencia: '2026-06-04', dataVencimento: '2026-06-08', dataPagamento: null, conciliado: false, idTransacaoBancaria: null },
  { id: 5, tipo: 'pagar', descricao: 'Folha de pagamento - Junho', categoriaId: 7, categoria: 'Pessoal', valor: 38900, status: 'pendente', fornecedorCliente: 'Folha interna', dataCompetencia: '2026-06-30', dataVencimento: '2026-06-30', dataPagamento: null, conciliado: false, idTransacaoBancaria: null },
  { id: 6, tipo: 'pagar', descricao: 'Fornecimento de cimento', categoriaId: 8, categoria: 'Insumos', valor: 6230.9, status: 'atrasado', fornecedorCliente: 'Cimentos Forte S.A.', dataCompetencia: '2026-05-20', dataVencimento: '2026-06-02', dataPagamento: null, conciliado: false, idTransacaoBancaria: null },
  { id: 7, tipo: 'receber', descricao: 'Consultoria técnica - Maio', categoriaId: 2, categoria: 'Serviços', valor: 5400, status: 'pendente', fornecedorCliente: 'Grupo Horizonte', dataCompetencia: '2026-05-31', dataVencimento: '2026-06-20', dataPagamento: null, conciliado: false, idTransacaoBancaria: null },
  { id: 8, tipo: 'pagar', descricao: 'Internet e telefonia', categoriaId: 11, categoria: 'Utilidades', valor: 389.9, status: 'pago', fornecedorCliente: 'Vivo Empresas', dataCompetencia: '2026-06-01', dataVencimento: '2026-06-12', dataPagamento: '2026-06-12', conciliado: true, idTransacaoBancaria: 'TXN-2026-0612-003' },
  { id: 9, tipo: 'pagar', descricao: 'ISS sobre serviços - Competência Maio/2026', categoriaId: 5, categoria: 'Deduções e Impostos', valor: 987.5, status: 'pago', fornecedorCliente: 'Prefeitura Municipal', dataCompetencia: '2026-05-31', dataVencimento: '2026-06-20', dataPagamento: '2026-06-18', conciliado: true, idTransacaoBancaria: 'TXN-2026-0618-004' },
];

// ─── 4. Fluxo de caixa ──────────────────────────────────────────────────────
// FluxoCaixaSection (financeiro.tsx) agrupa dadosLancamentos por mês de
// dataPagamento (regime de caixa) para montar a lista abaixo e o resumo
// (saldo atual, previsão de entradas/saídas a partir dos lançamentos sem
// dataPagamento).

export interface FluxoCaixaPeriodo {
  periodo: string;
  entradas: number;
  saidas: number;
  saldoAcumulado: number;
}

// ─── 5. Conciliação bancária ───────────────────────────────────────────────
// `conciliado` + `idTransacaoBancaria` (LancamentoFinanceiro) marcam um
// vínculo já CONFIRMADO com o extrato. `sugestaoMatchId` representa uma
// sugestão automática AINDA PENDENTE de confirmação manual — por isso os ids
// 4 e 6 abaixo têm sugestaoMatchId apontando para um lançamento, mas esse
// lançamento permanece com conciliado: false / idTransacaoBancaria: null em
// dadosLancamentos até a conciliação ser confirmada. ConciliacaoSection
// (financeiro.tsx) deriva o status (Conciliado/Pendente) a partir desses
// campos, em vez de um campo estático aqui.

export interface TransacaoExtrato {
  id: number;
  idTransacao: string; // identificador único do banco -> casa com LancamentoFinanceiro.idTransacaoBancaria
  descricaoBanco: string;
  data: string; // YYYY-MM-DD
  valor: number;
  tipo: 'credito' | 'debito';
  sugestaoMatchId: number | null;
}

export const dadosExtratoBancario: TransacaoExtrato[] = [
  { id: 1, idTransacao: 'TXN-2026-0605-001', descricaoBanco: 'TED RECEBIDA - CONSTRUTORA VALE VERDE', data: '2026-06-05', valor: 8500, tipo: 'credito', sugestaoMatchId: 1 },
  { id: 2, idTransacao: 'TXN-2026-0610-002', descricaoBanco: 'DEB AUT ALUGUEL IMOB SANTOS', data: '2026-06-10', valor: -4200, tipo: 'debito', sugestaoMatchId: 2 },
  { id: 3, idTransacao: 'TXN-2026-0612-003', descricaoBanco: 'PIX ENVIADO VIVO S.A.', data: '2026-06-12', valor: -389.9, tipo: 'debito', sugestaoMatchId: 8 },
  { id: 4, idTransacao: 'TXN-2026-0603-005', descricaoBanco: 'TED ENVIADA CIMENTOS FORTE', data: '2026-06-03', valor: -6230.9, tipo: 'debito', sugestaoMatchId: 6 },
  { id: 5, idTransacao: 'TXN-2026-0609-006', descricaoBanco: 'DEPOSITO IDENTIFICADO 001023', data: '2026-06-09', valor: 12750, tipo: 'credito', sugestaoMatchId: 4 },
  { id: 6, idTransacao: 'TXN-2026-0601-007', descricaoBanco: 'TARIFA MANUTENCAO CONTA', data: '2026-06-01', valor: -45, tipo: 'debito', sugestaoMatchId: null },
  { id: 7, idTransacao: 'TXN-2026-0618-004', descricaoBanco: 'DEB AUT ISS PREFEITURA MUNICIPAL', data: '2026-06-18', valor: -987.5, tipo: 'debito', sugestaoMatchId: 9 },
];

// ─── 6. Emissão de notas e DRE ──────────────────────────────────────────────

// DREItem representa as linhas (já agregadas) do demonstrativo, incluindo as
// linhas de 'resultado' (subtotais/totais) que não existem como categoria de
// lançamento. Os códigos/níveis aqui espelham dadosCategoriasFinanceiras.
// computeDRE (financeiro.tsx) monta esse array somando dadosLancamentos por
// categoriaId, seguindo a hierarquia parentId/nivel de dadosCategoriasFinanceiras.
export interface DREItem {
  id: number;
  codigo: string;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa' | 'resultado';
  nivel: number; // 0 = total, 1 = subitem, 2 = detalhe — usado para indentação (mesma escala de CategoriaFinanceira.nivel)
}
