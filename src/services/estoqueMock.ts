// Dados mockados do módulo Estoque e Logística (ainda sem endpoints no backend).
// Paleta de status segue o mesmo padrão { bg, bgDark, text } usado em
// PERFIL_COLORS (funcionarios.tsx / select-empresa.tsx), STATUS_COLORS e
// TIPO_LANCAMENTO_COLORS/TIPO_TRANSACAO_COLORS (financeiroMock.ts).

export interface StatusColor {
  bg: string;
  bgDark: string;
  text: string;
}

// ─── 1. Gestão de SKUs ──────────────────────────────────────────────────────

export interface SKU {
  id: number;
  codigoSKU: string;
  nomeProduto: string;
  variacao: string;
  categoria: string;
  precoCusto: number;
  precoVenda: number;
  quantidadeAtual: number;
  curvaABC: 'A' | 'B' | 'C';
}

// Mesma paleta de 3 cores usada em PERFIL_COLORS (funcionario/admin/dev) —
// A = prioridade alta, B = média, C = baixa.
export const CURVA_ABC_COLORS: Record<'A' | 'B' | 'C', StatusColor> = {
  A: { bg: '#eff6ff', bgDark: '#1e3a5f', text: '#3b5fe0' },
  B: { bg: '#fefce8', bgDark: '#3b2a05', text: '#ca8a04' },
  C: { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },
};

export const dadosSKUs: SKU[] = [
  { id: 1, codigoSKU: 'SKU-1001', nomeProduto: 'Cimento CP-II 50kg', variacao: 'Saco 50kg', categoria: 'Cimento e Argamassa', precoCusto: 28.50, precoVenda: 39.90, quantidadeAtual: 480, curvaABC: 'A' },
  { id: 2, codigoSKU: 'SKU-1002', nomeProduto: 'Tijolo Baiano 8 Furos', variacao: '9x14x24cm', categoria: 'Alvenaria', precoCusto: 0.85, precoVenda: 1.35, quantidadeAtual: 12500, curvaABC: 'A' },
  { id: 3, codigoSKU: 'SKU-1003', nomeProduto: 'Vergalhão CA-50', variacao: '10mm x 12m', categoria: 'Ferragens', precoCusto: 42.00, precoVenda: 58.90, quantidadeAtual: 320, curvaABC: 'A' },
  { id: 4, codigoSKU: 'SKU-1004', nomeProduto: 'Tinta Acrílica Premium', variacao: 'Branco - 18L', categoria: 'Tintas e Acabamentos', precoCusto: 145.00, precoVenda: 219.90, quantidadeAtual: 64, curvaABC: 'B' },
  { id: 5, codigoSKU: 'SKU-1005', nomeProduto: 'Argamassa AC-III', variacao: 'Saco 20kg', categoria: 'Cimento e Argamassa', precoCusto: 18.20, precoVenda: 26.50, quantidadeAtual: 210, curvaABC: 'B' },
  { id: 6, codigoSKU: 'SKU-1006', nomeProduto: 'Capacete de Segurança', variacao: 'Branco - Único', categoria: 'EPI', precoCusto: 12.00, precoVenda: 24.90, quantidadeAtual: 85, curvaABC: 'B' },
  { id: 7, codigoSKU: 'SKU-1007', nomeProduto: 'Disco de Corte Diamantado', variacao: '110mm', categoria: 'Ferramentas', precoCusto: 9.50, precoVenda: 18.90, quantidadeAtual: 142, curvaABC: 'B' },
  { id: 8, codigoSKU: 'SKU-1008', nomeProduto: 'Luva de Raspa', variacao: 'Tamanho G', categoria: 'EPI', precoCusto: 6.80, precoVenda: 13.50, quantidadeAtual: 8, curvaABC: 'C' },
  { id: 9, codigoSKU: 'SKU-1009', nomeProduto: 'Parafuso Drywall', variacao: '3.5x25mm - Cx 1000un', categoria: 'Fixadores', precoCusto: 22.00, precoVenda: 34.90, quantidadeAtual: 47, curvaABC: 'C' },
  { id: 10, codigoSKU: 'SKU-1010', nomeProduto: 'Mangueira de Nível', variacao: '20m', categoria: 'Ferramentas', precoCusto: 15.00, precoVenda: 27.90, quantidadeAtual: 3, curvaABC: 'C' },
  { id: 11, codigoSKU: 'SKU-1011', nomeProduto: 'Óculos de Proteção', variacao: 'Incolor', categoria: 'EPI', precoCusto: 4.50, precoVenda: 9.90, quantidadeAtual: 130, curvaABC: 'C' },
  { id: 12, codigoSKU: 'SKU-1012', nomeProduto: 'Protetor Auricular Plug', variacao: 'Par', categoria: 'EPI', precoCusto: 0.60, precoVenda: 1.80, quantidadeAtual: 540, curvaABC: 'C' },
  { id: 13, codigoSKU: 'SKU-1013', nomeProduto: 'Cinto de Segurança Tipo Paraquedista', variacao: 'M/G regulável', categoria: 'EPI', precoCusto: 89.00, precoVenda: 149.90, quantidadeAtual: 15, curvaABC: 'B' },
];

// ─── 2. Entrada / Saída ─────────────────────────────────────────────────────

// Cada movimentação representa uma linha da tabela — mesma estrutura "linha
// plana" usada por RegistroPonto (data/dia_semana/...) na página de Ponto,
// aqui com dataHora no lugar de data.
export type MotivoMovimentacao = 'venda' | 'compra' | 'avaria' | 'devolucao' | 'transferencia' | 'ajuste';

export interface MovimentacaoEstoque {
  id: number;
  tipoMovimentacao: 'entrada' | 'saida';
  codigoSKU: string;
  quantidade: number;
  dataHora: string; // ISO 8601
  motivo: MotivoMovimentacao;
  usuarioResponsavel: string;
}

// Mesmo padrão de TIPO_LANCAMENTO_COLORS/TIPO_TRANSACAO_COLORS (financeiroMock.ts):
// entrada ~ receber/crédito (verde), saída ~ pagar/débito (vermelho).
export const TIPO_MOVIMENTACAO_COLORS: Record<'entrada' | 'saida', StatusColor> = {
  entrada: { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },
  saida: { bg: '#fef2f2', bgDark: '#7f1d1d', text: '#dc2626' },
};

export const dadosMovimentacoesEstoque: MovimentacaoEstoque[] = [
  { id: 1, tipoMovimentacao: 'entrada', codigoSKU: 'SKU-1001', quantidade: 200, dataHora: '2026-06-10T08:15:00', motivo: 'compra', usuarioResponsavel: 'Carlos Almeida' },
  { id: 2, tipoMovimentacao: 'saida', codigoSKU: 'SKU-1002', quantidade: 1500, dataHora: '2026-06-10T09:40:00', motivo: 'venda', usuarioResponsavel: 'Fernanda Lima' },
  { id: 3, tipoMovimentacao: 'saida', codigoSKU: 'SKU-1003', quantidade: 40, dataHora: '2026-06-11T10:05:00', motivo: 'venda', usuarioResponsavel: 'Fernanda Lima' },
  { id: 4, tipoMovimentacao: 'entrada', codigoSKU: 'SKU-1004', quantidade: 30, dataHora: '2026-06-11T13:20:00', motivo: 'compra', usuarioResponsavel: 'Carlos Almeida' },
  { id: 5, tipoMovimentacao: 'saida', codigoSKU: 'SKU-1006', quantidade: 5, dataHora: '2026-06-12T07:50:00', motivo: 'avaria', usuarioResponsavel: 'João Pereira' },
  { id: 6, tipoMovimentacao: 'saida', codigoSKU: 'SKU-1008', quantidade: 12, dataHora: '2026-06-12T15:30:00', motivo: 'venda', usuarioResponsavel: 'Fernanda Lima' },
  { id: 7, tipoMovimentacao: 'entrada', codigoSKU: 'SKU-1009', quantidade: 60, dataHora: '2026-06-12T16:45:00', motivo: 'compra', usuarioResponsavel: 'Carlos Almeida' },
  { id: 8, tipoMovimentacao: 'entrada', codigoSKU: 'SKU-1005', quantidade: 10, dataHora: '2026-06-13T09:00:00', motivo: 'devolucao', usuarioResponsavel: 'João Pereira' },
  { id: 9, tipoMovimentacao: 'saida', codigoSKU: 'SKU-1010', quantidade: 7, dataHora: '2026-06-13T11:15:00', motivo: 'transferencia', usuarioResponsavel: 'João Pereira' },
  { id: 10, tipoMovimentacao: 'saida', codigoSKU: 'SKU-1007', quantidade: 18, dataHora: '2026-06-13T14:50:00', motivo: 'venda', usuarioResponsavel: 'Fernanda Lima' },
  { id: 11, tipoMovimentacao: 'entrada', codigoSKU: 'SKU-1003', quantidade: 100, dataHora: '2026-06-13T17:10:00', motivo: 'compra', usuarioResponsavel: 'Carlos Almeida' },
  { id: 12, tipoMovimentacao: 'saida', codigoSKU: 'SKU-1001', quantidade: 80, dataHora: '2026-06-14T08:30:00', motivo: 'ajuste', usuarioResponsavel: 'João Pereira' },
];

// ─── 3. Inventário utilizando a Nota Fiscal ────────────────────────────────

export interface NotaFiscalEstoque {
  id: number;
  numeroNF: string;
  chaveAcesso: string;
  fornecedor: string;
  dataEmissao: string; // YYYY-MM-DD
  totalItens: number;
  statusConferencia: 'pendente' | 'divergente' | 'concluido';
}

// pendente/concluido reaproveitam as mesmas cores de STATUS_COLORS
// (financeiroMock.ts); divergente segue o vermelho de erro/atrasado/cancelada.
export const STATUS_CONFERENCIA_COLORS: Record<'pendente' | 'divergente' | 'concluido', StatusColor> = {
  pendente: { bg: '#fefce8', bgDark: '#3b2a05', text: '#ca8a04' },
  divergente: { bg: '#fef2f2', bgDark: '#7f1d1d', text: '#dc2626' },
  concluido: { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },
};

export const dadosNotasFiscaisEstoque: NotaFiscalEstoque[] = [
  { id: 1, numeroNF: '000487', chaveAcesso: '35260612345678000199550010004870001234567890', fornecedor: 'Cimentos Forte S.A.', dataEmissao: '2026-06-09', totalItens: 3, statusConferencia: 'concluido' },
  { id: 2, numeroNF: '000512', chaveAcesso: '35260612345678000199550010005120001234567891', fornecedor: 'Aço Brasil Distribuidora', dataEmissao: '2026-06-11', totalItens: 2, statusConferencia: 'concluido' },
  { id: 3, numeroNF: '000533', chaveAcesso: '35260612345678000199550010005330001234567892', fornecedor: 'Tintas & Cia Ltda', dataEmissao: '2026-06-12', totalItens: 4, statusConferencia: 'pendente' },
  { id: 4, numeroNF: '000548', chaveAcesso: '35260612345678000199550010005480001234567893', fornecedor: 'EPI Distribuidora Sul', dataEmissao: '2026-06-13', totalItens: 5, statusConferencia: 'divergente' },
];

export interface ItemNotaFiscal {
  id: number;
  nomeProdutoNota: string;
  skuVinculado: string;
  qtdNota: number;
  qtdContadaFisica: number;
  statusItem: 'ok' | 'divergente';
}

// ok ~ verde de sucesso/concluido; divergente ~ vermelho de erro.
export const STATUS_ITEM_COLORS: Record<'ok' | 'divergente', StatusColor> = {
  ok: { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },
  divergente: { bg: '#fef2f2', bgDark: '#7f1d1d', text: '#dc2626' },
};

// Itens da NF 000548 (EPI Distribuidora Sul) — statusConferencia: 'divergente'
export const dadosItensNotaFiscal: ItemNotaFiscal[] = [
  { id: 1, nomeProdutoNota: 'Capacete de Segurança Branco', skuVinculado: 'SKU-1006', qtdNota: 50, qtdContadaFisica: 50, statusItem: 'ok' },
  { id: 2, nomeProdutoNota: 'Luva de Raspa Tamanho G', skuVinculado: 'SKU-1008', qtdNota: 100, qtdContadaFisica: 92, statusItem: 'divergente' },
  { id: 3, nomeProdutoNota: 'Óculos de Proteção Incolor', skuVinculado: 'SKU-1011', qtdNota: 60, qtdContadaFisica: 60, statusItem: 'ok' },
  { id: 4, nomeProdutoNota: 'Protetor Auricular Plug (par)', skuVinculado: 'SKU-1012', qtdNota: 200, qtdContadaFisica: 185, statusItem: 'divergente' },
  { id: 5, nomeProdutoNota: 'Cinto de Segurança Tipo Paraquedista', skuVinculado: 'SKU-1013', qtdNota: 15, qtdContadaFisica: 15, statusItem: 'ok' },
];

// ─── 4. Alertas de estoque mínimo e fornecedores ───────────────────────────

export interface FornecedorPadrao {
  nome: string;
  email: string;
  telefone: string;
}

export interface AlertaEstoque {
  id: number;
  codigoSKU: string;
  nomeProduto: string;
  estoqueAtual: number;
  estoqueMinimo: number;
  statusAlerta: 'critico' | 'atencao';
  fornecedorPadrao: FornecedorPadrao;
  leadTimeDias: number;
}

// critico ~ vermelho de atrasado/erro; atencao ~ amarelo de pendente.
export const STATUS_ALERTA_COLORS: Record<'critico' | 'atencao', StatusColor> = {
  critico: { bg: '#fef2f2', bgDark: '#7f1d1d', text: '#dc2626' },
  atencao: { bg: '#fefce8', bgDark: '#3b2a05', text: '#ca8a04' },
};

export const dadosAlertasEstoque: AlertaEstoque[] = [
  { id: 1, codigoSKU: 'SKU-1010', nomeProduto: 'Mangueira de Nível 20m', estoqueAtual: 3, estoqueMinimo: 15, statusAlerta: 'critico', fornecedorPadrao: { nome: 'Ferramentas Pro Ltda', email: 'vendas@ferramentaspro.com.br', telefone: '(11) 4002-8922' }, leadTimeDias: 5 },
  { id: 2, codigoSKU: 'SKU-1008', nomeProduto: 'Luva de Raspa Tamanho G', estoqueAtual: 8, estoqueMinimo: 40, statusAlerta: 'critico', fornecedorPadrao: { nome: 'EPI Distribuidora Sul', email: 'comercial@episul.com.br', telefone: '(51) 3322-1190' }, leadTimeDias: 7 },
  { id: 3, codigoSKU: 'SKU-1009', nomeProduto: 'Parafuso Drywall 3.5x25mm (Cx 1000un)', estoqueAtual: 47, estoqueMinimo: 100, statusAlerta: 'atencao', fornecedorPadrao: { nome: 'Fixa Tudo Parafusos', email: 'pedidos@fixatudo.com.br', telefone: '(31) 3555-7744' }, leadTimeDias: 4 },
  { id: 4, codigoSKU: 'SKU-1004', nomeProduto: 'Tinta Acrílica Premium Branco 18L', estoqueAtual: 64, estoqueMinimo: 80, statusAlerta: 'atencao', fornecedorPadrao: { nome: 'Tintas & Cia Ltda', email: 'atendimento@tintasecia.com.br', telefone: '(11) 2233-4455' }, leadTimeDias: 6 },
  { id: 5, codigoSKU: 'SKU-1013', nomeProduto: 'Cinto de Segurança Tipo Paraquedista', estoqueAtual: 15, estoqueMinimo: 20, statusAlerta: 'atencao', fornecedorPadrao: { nome: 'EPI Distribuidora Sul', email: 'comercial@episul.com.br', telefone: '(51) 3322-1190' }, leadTimeDias: 7 },
];
