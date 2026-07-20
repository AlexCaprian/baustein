import React, { useRef, useState } from 'react';
import { Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import * as XLSX from 'xlsx';
import { ModuleHeader } from '@/components/layout/module-header';
import { decodeId } from '@/services/idHash';
import { api, NotaFiscalInput } from '@/services/api';
import { dadosCategoriasFinanceiras } from '@/services/financeiroMock';
import {
  StatusColor,
  SKU,
  dadosSKUs,
  CURVA_ABC_COLORS,
  MovimentacaoEstoque,
  MotivoMovimentacao,
  dadosMovimentacoesEstoque,
  TIPO_MOVIMENTACAO_COLORS,
  NotaFiscalEstoque,
  dadosNotasFiscaisEstoque,
  STATUS_CONFERENCIA_COLORS,
  dadosItensNotaFiscal,
  STATUS_ITEM_COLORS,
  dadosAlertasEstoque,
  STATUS_ALERTA_COLORS,
} from '@/services/estoqueMock';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const monoFont = Platform.OS === 'web' ? 'monospace' : undefined;

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDataHora(iso: string): string {
  const [data, hora] = iso.split('T');
  return `${fmtData(data)} ${hora?.slice(0, 5) ?? ''}`;
}

function parseDataHoraBR(s: string): string {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})/);
  if (!m) return new Date().toISOString().slice(0, 19);
  const [, d, mo, y, h, mi] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi}:00`;
}

function parseDataBR(s: string): string {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return new Date().toISOString().slice(0, 10);
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function parseNumeroBR(s: string): number {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function nextId(list: { id: number }[]): number {
  return list.reduce((max, x) => Math.max(max, x.id), 0) + 1;
}

const TIPO_MOVIMENTACAO_LABEL: Record<'entrada' | 'saida', string> = {
  entrada: 'Entrada',
  saida: 'Saída',
};

function parseTipoMovimentacao(s: string): 'entrada' | 'saida' {
  return s.trim().toLowerCase().startsWith('e') ? 'entrada' : 'saida';
}

const MOTIVO_LABEL: Record<MotivoMovimentacao, string> = {
  venda: 'Venda',
  compra: 'Compra',
  avaria: 'Avaria',
  devolucao: 'Devolução',
  transferencia: 'Transferência',
  ajuste: 'Ajuste',
};

const MOTIVOS: MotivoMovimentacao[] = ['venda', 'compra', 'avaria', 'devolucao', 'transferencia', 'ajuste'];

function parseMotivo(s: string): MotivoMovimentacao {
  const norm = s.trim().toLowerCase();
  return MOTIVOS.find(m => MOTIVO_LABEL[m].toLowerCase() === norm) ?? 'ajuste';
}

const STATUS_CONFERENCIA_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  divergente: 'Divergente',
  concluido: 'Concluído',
};

const STATUS_ITEM_LABEL: Record<string, string> = {
  ok: 'OK',
  divergente: 'Divergente',
};

const STATUS_ALERTA_LABEL: Record<string, string> = {
  critico: 'Crítico',
  atencao: 'Atenção',
};

// ─── Formulários ────────────────────────────────────────────────────────────

type SKUFormState = {
  codigoSKU: string;
  nomeProduto: string;
  variacao: string;
  categoria: string;
  precoCusto: string;
  precoVenda: string;
  quantidadeAtual: string;
  curvaABC: 'A' | 'B' | 'C';
};

const EMPTY_SKU_FORM: SKUFormState = {
  codigoSKU: '', nomeProduto: '', variacao: '', categoria: '',
  precoCusto: '', precoVenda: '', quantidadeAtual: '', curvaABC: 'B',
};

type MovFormState = {
  tipoMovimentacao: 'entrada' | 'saida';
  codigoSKU: string;
  quantidade: string;
  motivo: MotivoMovimentacao;
  usuarioResponsavel: string;
};

const EMPTY_MOV_FORM: MovFormState = {
  tipoMovimentacao: 'entrada', codigoSKU: '', quantidade: '', motivo: 'compra', usuarioResponsavel: '',
};

type NotaFiscalEstoqueFormState = {
  numeroNF: string;
  chaveAcesso: string;
  fornecedor: string;
  categoria: string;
  valor: string;
  dataEmissao: string;
  dataVencimento: string;
  totalItens: string;
};

const EMPTY_NOTA_FISCAL_ESTOQUE_FORM: NotaFiscalEstoqueFormState = {
  numeroNF: '', chaveAcesso: '', fornecedor: '', categoria: '', valor: '', dataEmissao: '', dataVencimento: '', totalItens: '',
};

// ─── Componentes de tabela (mesmo padrão visual da página de Ponto) ────────────

function Badge({ label, color, isDark }: { label: string; color: StatusColor; isDark: boolean }) {
  return (
    <View style={{ backgroundColor: isDark ? color.bgDark : color.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' }}>
      <Text style={{ color: color.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function TableHead({ cols, isDark }: { cols: { label: string; width: number }[]; isDark: boolean }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1f2937' : '#f8fafc', borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#e2e8f0' }}>
      {cols.map((c, i) => (
        <View key={i} style={{ width: c.width, paddingHorizontal: 8, paddingVertical: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#9ca3af' : '#64748b', textTransform: 'uppercase' }} numberOfLines={1}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

function TableRow({ idx, isDark, children }: { idx: number; isDark: boolean; children: React.ReactNode }) {
  const bg = idx % 2 === 0 ? 'transparent' : (isDark ? '#0a0e1a' : '#fafafa');
  return (
    <View style={{ flexDirection: 'row', backgroundColor: bg, borderBottomWidth: 1, borderBottomColor: isDark ? '#1f2937' : '#f1f5f9', alignItems: 'center' }}>
      {children}
    </View>
  );
}

function Cell({ width, children }: { width: number; children?: React.ReactNode }) {
  return <View style={{ width, paddingHorizontal: 8, paddingVertical: 10 }}>{children}</View>;
}

function CellText({ width, children, mono, bold, color, isDark }: {
  width: number;
  children: React.ReactNode;
  mono?: boolean;
  bold?: boolean;
  color?: string;
  isDark: boolean;
}) {
  return (
    <Cell width={width}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: bold ? '600' : '400',
          fontFamily: mono ? monoFont : undefined,
          color: color ?? (isDark ? '#e5e7eb' : '#374151'),
        }}
        numberOfLines={1}
      >
        {children}
      </Text>
    </Cell>
  );
}

function SectionTitle({ title, isDark, style }: { title: string; isDark: boolean; style?: object }) {
  return (
    <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#f9fafb' : '#1e2d6e', marginBottom: 10, ...style }}>
      {title}
    </Text>
  );
}

function SectionHeader({ title, isDark, isMobile, children }: { title: string; isDark: boolean; isMobile: boolean; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
      <SectionTitle title={title} isDark={isDark} style={{ marginBottom: 0 }} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {children}
      </View>
    </View>
  );
}

function ToolbarButton({ icon, label, onPress, isDark, primary }: { icon: string; label: string; onPress: () => void; isDark: boolean; primary?: boolean }) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: primary ? '#3b5fe0' : (isDark ? '#1f2937' : '#fff'),
        borderWidth: primary ? 0 : 1, borderColor: isDark ? '#374151' : '#e2e8f0',
        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
      }}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon as any} size={15} color={primary ? '#fff' : (isDark ? '#9ca3af' : '#6b7280')} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: primary ? '#fff' : (isDark ? '#e5e7eb' : '#374151') }}>{label}</Text>
    </TouchableOpacity>
  );
}

function RowActions({ onEdit, onDelete, isDark }: { onEdit?: () => void; onDelete: () => void; isDark: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {onEdit && (
        <TouchableOpacity
          style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }}
          onPress={onEdit}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={14} color="#3b5fe0" />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: isDark ? '#3b0f0f' : '#fff1f2' }}
        onPress={onDelete}
        activeOpacity={0.8}
      >
        <Ionicons name="trash-outline" size={14} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Tabela com colunas elásticas: quando o container é mais largo que a soma das
// larguras mínimas, o espaço extra é distribuído proporcionalmente entre as
// colunas (mesmo cálculo de effectiveColWidths usado na página de Ponto).
// Inclui paginação própria, com seletor de linhas por página.
function Table<T>({ cols, data, isDark, keyExtractor, renderRow }: {
  cols: { label: string; width: number }[];
  data: T[];
  isDark: boolean;
  keyExtractor: (item: T) => string | number;
  renderRow: (item: T, idx: number, widths: number[]) => React.ReactNode;
}) {
  const [tableWidth, setTableWidth] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeMenuVisible, setPageSizeMenuVisible] = useState(false);

  const minWidths = cols.map(c => c.width);
  const minTotal = minWidths.reduce((a, b) => a + b, 0);
  const widths = tableWidth > minTotal
    ? minWidths.map(w => w + (w / minTotal) * (tableWidth - minTotal))
    : minWidths;

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageData = data.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = data.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(data.length, safePage * pageSize);

  return (
    <View style={{ backgroundColor: isDark ? '#111827' : '#fff', borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#1f2937' : '#e2e8f0', overflow: 'hidden' }}>
      <View onLayout={e => setTableWidth(e.nativeEvent.layout.width)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={tableWidth <= minTotal}>
          <View style={{ width: Math.max(tableWidth, minTotal) }}>
            <TableHead cols={cols.map((c, i) => ({ label: c.label, width: widths[i] }))} isDark={isDark} />
            {pageData.map((item, idx) => (
              <TableRow key={keyExtractor(item)} idx={idx} isDark={isDark}>
                {renderRow(item, idx, widths)}
              </TableRow>
            ))}
            {pageData.length === 0 && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: isDark ? '#6b7280' : '#9ca3af' }}>Nenhum registro encontrado</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: isDark ? '#1f2937' : '#f1f5f9' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280' }}>Linhas por página</Text>
          <TouchableOpacity
            onPress={() => setPageSizeMenuVisible(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: isDark ? '#374151' : '#e2e8f0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#e5e7eb' : '#374151' }}>{pageSize}</Text>
            <Ionicons name="chevron-down" size={12} color={isDark ? '#9ca3af' : '#6b7280'} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Text style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280' }}>
            {data.length === 0 ? '0 de 0' : `${rangeStart}–${rangeEnd} de ${data.length}`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity
              disabled={safePage <= 1}
              onPress={() => setPage(safePage - 1)}
              style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6, opacity: safePage <= 1 ? 0.4 : 1, backgroundColor: isDark ? '#1f2937' : '#f8fafc' }}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
            <TouchableOpacity
              disabled={safePage >= totalPages}
              onPress={() => setPage(safePage + 1)}
              style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6, opacity: safePage >= totalPages ? 0.4 : 1, backgroundColor: isDark ? '#1f2937' : '#f8fafc' }}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-forward" size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={pageSizeMenuVisible} transparent animationType="fade" onRequestClose={() => setPageSizeMenuVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setPageSizeMenuVisible(false)}>
          <View style={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderRadius: 10, overflow: 'hidden', minWidth: 120, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }}>
            {ROWS_PER_PAGE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                onPress={() => { setPageSize(opt); setPage(1); setPageSizeMenuVisible(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11, backgroundColor: pageSize === opt ? (isDark ? '#1e3a5f' : '#eff6ff') : 'transparent' }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 14, color: isDark ? '#e5e7eb' : '#1f2937' }}>{opt}</Text>
                {pageSize === opt && <Ionicons name="checkmark" size={14} color={isDark ? '#60a5fa' : '#3b5fe0'} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Abas ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'skus', label: 'SKUs', icon: 'pricetags-outline' },
  { key: 'movimentacoes', label: 'Entrada / Saída', icon: 'swap-vertical-outline' },
  { key: 'inventario', label: 'Inventário (NF)', icon: 'document-text-outline' },
  { key: 'alertas', label: 'Alertas', icon: 'alert-circle-outline' },
] as const;

type TabKey = typeof TABS[number]['key'];

// ─── 1. Gestão de SKUs ──────────────────────────────────────────────────────

const SKU_COLS = [
  { label: 'Código SKU', width: 110 },
  { label: 'Produto', width: 210 },
  { label: 'Variação', width: 140 },
  { label: 'Categoria', width: 150 },
  { label: 'Preço Custo', width: 110 },
  { label: 'Preço Venda', width: 110 },
  { label: 'Qtd. Atual', width: 100 },
  { label: 'Curva ABC', width: 90 },
  { label: 'Ações', width: 76 },
];

function SKUsSection({ isDark, isMobile, skus, onNew, onEdit, onDelete, onExport, onImport }: {
  isDark: boolean;
  isMobile: boolean;
  skus: SKU[];
  onNew: () => void;
  onEdit: (s: SKU) => void;
  onDelete: (s: SKU) => void;
  onExport: () => void;
  onImport: () => void;
}) {
  return (
    <View>
      <SectionHeader title="SKUs cadastrados" isDark={isDark} isMobile={isMobile}>
        {Platform.OS === 'web' && <ToolbarButton icon="cloud-upload-outline" label="Importar" onPress={onImport} isDark={isDark} />}
        <ToolbarButton icon="download-outline" label="Exportar" onPress={onExport} isDark={isDark} />
        <ToolbarButton icon="add" label="Novo SKU" onPress={onNew} isDark={isDark} primary />
      </SectionHeader>
      <Table
        cols={SKU_COLS}
        data={skus}
        isDark={isDark}
        keyExtractor={s => s.id}
        renderRow={(s, _idx, w) => (
          <>
            <CellText width={w[0]} mono isDark={isDark}>{s.codigoSKU}</CellText>
            <CellText width={w[1]} bold isDark={isDark}>{s.nomeProduto}</CellText>
            <CellText width={w[2]} color={isDark ? '#9ca3af' : '#6b7280'} isDark={isDark}>{s.variacao}</CellText>
            <CellText width={w[3]} color={isDark ? '#9ca3af' : '#6b7280'} isDark={isDark}>{s.categoria}</CellText>
            <CellText width={w[4]} mono isDark={isDark}>{fmtMoeda(s.precoCusto)}</CellText>
            <CellText width={w[5]} mono isDark={isDark}>{fmtMoeda(s.precoVenda)}</CellText>
            <CellText width={w[6]} mono bold isDark={isDark}>{s.quantidadeAtual.toLocaleString('pt-BR')}</CellText>
            <Cell width={w[7]}>
              <Badge label={s.curvaABC} color={CURVA_ABC_COLORS[s.curvaABC]} isDark={isDark} />
            </Cell>
            <Cell width={w[8]}>
              <RowActions onEdit={() => onEdit(s)} onDelete={() => onDelete(s)} isDark={isDark} />
            </Cell>
          </>
        )}
      />
    </View>
  );
}

// ─── 2. Entrada / Saída ─────────────────────────────────────────────────────

const MOV_COLS = [
  { label: 'Data/Hora', width: 150 },
  { label: 'Tipo', width: 100 },
  { label: 'Código SKU', width: 110 },
  { label: 'Quantidade', width: 110 },
  { label: 'Motivo', width: 140 },
  { label: 'Responsável', width: 170 },
  { label: 'Ações', width: 50 },
];

function MovimentacoesSection({ isDark, isMobile, movimentacoes, onNew, onDelete, onExport, onImport }: {
  isDark: boolean;
  isMobile: boolean;
  movimentacoes: MovimentacaoEstoque[];
  onNew: () => void;
  onDelete: (m: MovimentacaoEstoque) => void;
  onExport: () => void;
  onImport: () => void;
}) {
  return (
    <View>
      <SectionHeader title="Histórico de movimentações" isDark={isDark} isMobile={isMobile}>
        {Platform.OS === 'web' && <ToolbarButton icon="cloud-upload-outline" label="Importar" onPress={onImport} isDark={isDark} />}
        <ToolbarButton icon="download-outline" label="Exportar" onPress={onExport} isDark={isDark} />
        <ToolbarButton icon="add" label="Nova Movimentação" onPress={onNew} isDark={isDark} primary />
      </SectionHeader>
      <Table
        cols={MOV_COLS}
        data={movimentacoes}
        isDark={isDark}
        keyExtractor={m => m.id}
        renderRow={(m, _idx, w) => {
          const cor = TIPO_MOVIMENTACAO_COLORS[m.tipoMovimentacao];
          const sinal = m.tipoMovimentacao === 'entrada' ? '+' : '-';
          return (
            <>
              <CellText width={w[0]} mono isDark={isDark}>{fmtDataHora(m.dataHora)}</CellText>
              <Cell width={w[1]}>
                <Badge label={TIPO_MOVIMENTACAO_LABEL[m.tipoMovimentacao]} color={cor} isDark={isDark} />
              </Cell>
              <CellText width={w[2]} mono isDark={isDark}>{m.codigoSKU}</CellText>
              <CellText width={w[3]} mono bold color={cor.text} isDark={isDark}>{sinal}{m.quantidade}</CellText>
              <CellText width={w[4]} color={isDark ? '#9ca3af' : '#6b7280'} isDark={isDark}>{MOTIVO_LABEL[m.motivo] ?? m.motivo}</CellText>
              <CellText width={w[5]} isDark={isDark}>{m.usuarioResponsavel}</CellText>
              <Cell width={w[6]}>
                <RowActions onDelete={() => onDelete(m)} isDark={isDark} />
              </Cell>
            </>
          );
        }}
      />
    </View>
  );
}

// ─── 3. Inventário utilizando a Nota Fiscal ────────────────────────────────

const NF_COLS = [
  { label: 'Número NF', width: 110 },
  { label: 'Fornecedor', width: 240 },
  { label: 'Data Emissão', width: 120 },
  { label: 'Total Itens', width: 100 },
  { label: 'Status Conferência', width: 160 },
];

const ITEM_NF_COLS = [
  { label: 'Produto (Nota)', width: 260 },
  { label: 'SKU Vinculado', width: 130 },
  { label: 'Qtd. Nota', width: 100 },
  { label: 'Qtd. Contada', width: 110 },
  { label: 'Status', width: 110 },
];

function InventarioSection({ isDark, isMobile, notas, onNovaNota }: {
  isDark: boolean;
  isMobile: boolean;
  notas: NotaFiscalEstoque[];
  onNovaNota: () => void;
}) {
  const nfDivergente = notas.find(n => n.statusConferencia === 'divergente');

  return (
    <View>
      <SectionHeader title="Notas fiscais importadas" isDark={isDark} isMobile={isMobile}>
        <ToolbarButton icon="add" label="Nova Nota Fiscal" onPress={onNovaNota} isDark={isDark} primary />
      </SectionHeader>
      <Table
        cols={NF_COLS}
        data={notas}
        isDark={isDark}
        keyExtractor={n => n.id}
        renderRow={(n, _idx, w) => (
          <>
            <CellText width={w[0]} mono isDark={isDark}>{n.numeroNF}</CellText>
            <CellText width={w[1]} bold isDark={isDark}>{n.fornecedor}</CellText>
            <CellText width={w[2]} mono isDark={isDark}>{fmtData(n.dataEmissao)}</CellText>
            <CellText width={w[3]} mono isDark={isDark}>{n.totalItens}</CellText>
            <Cell width={w[4]}>
              <Badge label={STATUS_CONFERENCIA_LABEL[n.statusConferencia]} color={STATUS_CONFERENCIA_COLORS[n.statusConferencia]} isDark={isDark} />
            </Cell>
          </>
        )}
      />

      <SectionTitle
        title={`Itens da NF ${nfDivergente?.numeroNF ?? ''} — ${nfDivergente?.fornecedor ?? ''} (conferência)`}
        isDark={isDark}
        style={{ marginTop: 24 }}
      />
      <Table
        cols={ITEM_NF_COLS}
        data={dadosItensNotaFiscal}
        isDark={isDark}
        keyExtractor={it => it.id}
        renderRow={(it, _idx, w) => {
          const divergente = it.statusItem === 'divergente';
          return (
            <>
              <CellText width={w[0]} bold isDark={isDark}>{it.nomeProdutoNota}</CellText>
              <CellText width={w[1]} mono isDark={isDark}>{it.skuVinculado}</CellText>
              <CellText width={w[2]} mono isDark={isDark}>{it.qtdNota}</CellText>
              <CellText width={w[3]} mono bold color={divergente ? STATUS_ITEM_COLORS.divergente.text : undefined} isDark={isDark}>{it.qtdContadaFisica}</CellText>
              <Cell width={w[4]}>
                <Badge label={STATUS_ITEM_LABEL[it.statusItem]} color={STATUS_ITEM_COLORS[it.statusItem]} isDark={isDark} />
              </Cell>
            </>
          );
        }}
      />
    </View>
  );
}

// ─── 4. Alertas de estoque mínimo e fornecedores ───────────────────────────

const ALERTA_COLS = [
  { label: 'Código SKU', width: 110 },
  { label: 'Produto', width: 220 },
  { label: 'Estoque Atual', width: 110 },
  { label: 'Estoque Mínimo', width: 120 },
  { label: 'Status', width: 100 },
  { label: 'Fornecedor Padrão', width: 230 },
  { label: 'Lead Time', width: 100 },
];

function AlertasSection({ isDark }: { isDark: boolean }) {
  const criticos = dadosAlertasEstoque.filter(a => a.statusAlerta === 'critico').length;
  const atencao = dadosAlertasEstoque.filter(a => a.statusAlerta === 'atencao').length;

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Badge label={`${criticos} crítico${criticos !== 1 ? 's' : ''}`} color={STATUS_ALERTA_COLORS.critico} isDark={isDark} />
        <Badge label={`${atencao} em atenção`} color={STATUS_ALERTA_COLORS.atencao} isDark={isDark} />
      </View>
      <SectionTitle title="Produtos em estoque crítico" isDark={isDark} />
      <Table
        cols={ALERTA_COLS}
        data={dadosAlertasEstoque}
        isDark={isDark}
        keyExtractor={a => a.id}
        renderRow={(a, _idx, w) => {
          const cor = STATUS_ALERTA_COLORS[a.statusAlerta];
          return (
            <>
              <CellText width={w[0]} mono isDark={isDark}>{a.codigoSKU}</CellText>
              <CellText width={w[1]} bold isDark={isDark}>{a.nomeProduto}</CellText>
              <CellText width={w[2]} mono bold color={cor.text} isDark={isDark}>{a.estoqueAtual}</CellText>
              <CellText width={w[3]} mono color={isDark ? '#9ca3af' : '#6b7280'} isDark={isDark}>{a.estoqueMinimo}</CellText>
              <Cell width={w[4]}>
                <Badge label={STATUS_ALERTA_LABEL[a.statusAlerta]} color={cor} isDark={isDark} />
              </Cell>
              <Cell width={w[5]}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#e5e7eb' : '#374151' }} numberOfLines={1}>{a.fornecedorPadrao.nome}</Text>
                <Text style={{ fontSize: 11, color: isDark ? '#6b7280' : '#94a3b8', marginTop: 1 }} numberOfLines={1}>{a.fornecedorPadrao.telefone}</Text>
              </Cell>
              <CellText width={w[6]} isDark={isDark}>{a.leadTimeDias} dia{a.leadTimeDias !== 1 ? 's' : ''}</CellText>
            </>
          );
        }}
      />
    </View>
  );
}

// ─── Tela principal ─────────────────────────────────────────────────────────

export default function EstoqueScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const params = useLocalSearchParams<{ empresaId: string; empresaName: string; grupoId: string }>();
  const empresaId = decodeId(params.empresaId);
  const empresaName = params.empresaName ?? '';
  const grupoId = decodeId(params.grupoId);

  const [tab, setTab] = useState<TabKey>('skus');

  const [skus, setSkus] = useState<SKU[]>(dadosSKUs);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>(dadosMovimentacoesEstoque);
  const [notasFiscaisEstoque, setNotasFiscaisEstoque] = useState<NotaFiscalEstoque[]>(dadosNotasFiscaisEstoque);

  const [importMsg, setImportMsg] = useState('');

  const skuFileInputRef = useRef<HTMLInputElement | null>(null);
  const movFileInputRef = useRef<HTMLInputElement | null>(null);

  const ph = isDark ? '#4b5563' : '#bbb';

  // ── SKU: criar / editar / remover ─────────────────────────────────────────

  const [skuModalVisible, setSkuModalVisible] = useState(false);
  const [skuEditingId, setSkuEditingId] = useState<number | null>(null);
  const [skuForm, setSkuForm] = useState<SKUFormState>(EMPTY_SKU_FORM);
  const [skuErro, setSkuErro] = useState('');
  const [skuDeleteTarget, setSkuDeleteTarget] = useState<SKU | null>(null);

  function openNewSkuModal() {
    setSkuEditingId(null);
    setSkuForm(EMPTY_SKU_FORM);
    setSkuErro('');
    setSkuModalVisible(true);
  }

  function openEditSkuModal(s: SKU) {
    setSkuEditingId(s.id);
    setSkuForm({
      codigoSKU: s.codigoSKU,
      nomeProduto: s.nomeProduto,
      variacao: s.variacao,
      categoria: s.categoria,
      precoCusto: String(s.precoCusto),
      precoVenda: String(s.precoVenda),
      quantidadeAtual: String(s.quantidadeAtual),
      curvaABC: s.curvaABC,
    });
    setSkuErro('');
    setSkuModalVisible(true);
  }

  function handleSaveSku() {
    const f = skuForm;
    if (!f.codigoSKU.trim() || !f.nomeProduto.trim() || !f.precoCusto.trim() || !f.precoVenda.trim() || !f.quantidadeAtual.trim()) {
      setSkuErro('Preencha todos os campos obrigatórios.');
      return;
    }
    const codigo = f.codigoSKU.trim();
    if (skus.some(s => s.codigoSKU === codigo && s.id !== skuEditingId)) {
      setSkuErro('Já existe um SKU com este código.');
      return;
    }
    const dados = {
      codigoSKU: codigo,
      nomeProduto: f.nomeProduto.trim(),
      variacao: f.variacao.trim(),
      categoria: f.categoria.trim(),
      precoCusto: parseNumeroBR(f.precoCusto),
      precoVenda: parseNumeroBR(f.precoVenda),
      quantidadeAtual: Math.max(0, Math.round(parseNumeroBR(f.quantidadeAtual))),
      curvaABC: f.curvaABC,
    };
    if (skuEditingId != null) {
      setSkus(prev => prev.map(s => s.id === skuEditingId ? { ...s, ...dados } : s));
    } else {
      setSkus(prev => [...prev, { id: nextId(prev), ...dados }]);
    }
    setSkuModalVisible(false);
  }

  function handleDeleteSku() {
    if (!skuDeleteTarget) return;
    setSkus(prev => prev.filter(s => s.id !== skuDeleteTarget.id));
    setSkuDeleteTarget(null);
  }

  // ── Movimentações: registrar entrada/saída e remover ──────────────────────

  const [movModalVisible, setMovModalVisible] = useState(false);
  const [movForm, setMovForm] = useState<MovFormState>(EMPTY_MOV_FORM);
  const [movErro, setMovErro] = useState('');
  const [movDeleteTarget, setMovDeleteTarget] = useState<MovimentacaoEstoque | null>(null);
  const [skuPickerVisible, setSkuPickerVisible] = useState(false);
  const [skuPickerSearch, setSkuPickerSearch] = useState('');

  function openNewMovModal() {
    setMovForm(EMPTY_MOV_FORM);
    setMovErro('');
    setMovModalVisible(true);
  }

  // sinal=1 aplica o efeito da movimentação no estoque; sinal=-1 desfaz (usado ao remover)
  function applyMovimentacaoToStock(codigoSKU: string, tipo: 'entrada' | 'saida', quantidade: number, sinal: 1 | -1) {
    setSkus(prev => prev.map(s => s.codigoSKU === codigoSKU
      ? { ...s, quantidadeAtual: Math.max(0, s.quantidadeAtual + sinal * (tipo === 'entrada' ? quantidade : -quantidade)) }
      : s));
  }

  function handleSaveMov() {
    const f = movForm;
    const qtd = Math.round(parseNumeroBR(f.quantidade));
    if (!f.codigoSKU.trim() || !qtd || qtd <= 0 || !f.usuarioResponsavel.trim()) {
      setMovErro('Selecione o SKU e preencha quantidade e responsável.');
      return;
    }
    const skuAlvo = skus.find(s => s.codigoSKU === f.codigoSKU);
    if (!skuAlvo) {
      setMovErro('SKU não encontrado.');
      return;
    }
    if (f.tipoMovimentacao === 'saida' && skuAlvo.quantidadeAtual < qtd) {
      setMovErro(`Estoque insuficiente: disponível ${skuAlvo.quantidadeAtual}, solicitado ${qtd}.`);
      return;
    }
    const nova: MovimentacaoEstoque = {
      id: nextId(movimentacoes),
      tipoMovimentacao: f.tipoMovimentacao,
      codigoSKU: f.codigoSKU,
      quantidade: qtd,
      dataHora: new Date().toISOString().slice(0, 19),
      motivo: f.motivo,
      usuarioResponsavel: f.usuarioResponsavel.trim(),
    };
    setMovimentacoes(prev => [nova, ...prev]);
    applyMovimentacaoToStock(nova.codigoSKU, nova.tipoMovimentacao, nova.quantidade, 1);
    setMovModalVisible(false);
  }

  function handleDeleteMov() {
    if (!movDeleteTarget) return;
    const m = movDeleteTarget;
    setMovimentacoes(prev => prev.filter(x => x.id !== m.id));
    applyMovimentacaoToStock(m.codigoSKU, m.tipoMovimentacao, m.quantidade, -1);
    setMovDeleteTarget(null);
  }

  // ── Inventário: Nova Nota Fiscal de entrada (conectado ao Financeiro) ─────

  const [notaEstoqueModalVisible, setNotaEstoqueModalVisible] = useState(false);
  const [notaEstoqueForm, setNotaEstoqueForm] = useState<NotaFiscalEstoqueFormState>(EMPTY_NOTA_FISCAL_ESTOQUE_FORM);
  const [notaEstoqueErro, setNotaEstoqueErro] = useState('');
  const [notaEstoqueSalvando, setNotaEstoqueSalvando] = useState(false);

  function openNovaNotaEstoqueModal() {
    setNotaEstoqueForm(EMPTY_NOTA_FISCAL_ESTOQUE_FORM);
    setNotaEstoqueErro('');
    setNotaEstoqueModalVisible(true);
  }

  async function handleSaveNotaEstoque() {
    const f = notaEstoqueForm;
    if (!f.numeroNF.trim() || !f.fornecedor.trim() || !f.categoria.trim() || !f.valor.trim() || !f.dataEmissao.trim() || !f.dataVencimento.trim() || !f.totalItens.trim()) {
      setNotaEstoqueErro('Preencha todos os campos obrigatórios.');
      return;
    }
    const valor = parseNumeroBR(f.valor);
    if (!valor || valor <= 0) {
      setNotaEstoqueErro('Informe um valor válido.');
      return;
    }
    const totalItens = Math.max(0, Math.round(parseNumeroBR(f.totalItens)));
    const categoriaEncontrada = dadosCategoriasFinanceiras.find(c => c.nome.toLowerCase() === f.categoria.trim().toLowerCase());
    const categoriaCodigo = categoriaEncontrada?.codigo ?? '3.5.9';
    const dataEmissao = parseDataBR(f.dataEmissao);
    const dataVencimento = parseDataBR(f.dataVencimento);

    const dados: NotaFiscalInput = {
      empresa_id: empresaId,
      tipo: 'entrada',
      origem: 'estoque',
      numero: f.numeroNF.trim(),
      serie: '1',
      chave_acesso: f.chaveAcesso.trim(),
      cliente_fornecedor: f.fornecedor.trim(),
      categoria_codigo: categoriaCodigo,
      valor,
      data_emissao: dataEmissao,
      data_vencimento: dataVencimento,
      status: 'emitida',
    };

    setNotaEstoqueSalvando(true);
    try {
      await api.notasFiscais.create(dados);
      setNotasFiscaisEstoque(prev => [...prev, {
        id: nextId(prev),
        numeroNF: f.numeroNF.trim(),
        chaveAcesso: f.chaveAcesso.trim(),
        fornecedor: f.fornecedor.trim(),
        dataEmissao,
        totalItens,
        statusConferencia: 'pendente',
      }]);
      setNotaEstoqueModalVisible(false);
      setImportMsg('Nota fiscal cadastrada com sucesso e contabilizada no Financeiro (Contas a Pagar).');
      setTimeout(() => setImportMsg(''), 4000);
    } catch {
      setNotaEstoqueErro('Erro ao salvar nota fiscal. Verifique a conexão com o servidor.');
    } finally {
      setNotaEstoqueSalvando(false);
    }
  }

  // ── Exportar / Importar XLSX e CSV ────────────────────────────────────────

  function exportSkusXLSX() {
    const header = ['Código SKU', 'Produto', 'Variação', 'Categoria', 'Preço Custo', 'Preço Venda', 'Qtd. Atual', 'Curva ABC'];
    const rows = skus.map(s => [s.codigoSKU, s.nomeProduto, s.variacao, s.categoria, s.precoCusto, s.precoVenda, s.quantidadeAtual, s.curvaABC]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKUs');
    XLSX.writeFile(wb, `skus_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleImportSkusFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const headerIdx = rows.findIndex(r => r && String(r[0] ?? '').toLowerCase().includes('sku'));
        if (headerIdx === -1) {
          setImportMsg('Formato inválido: cabeçalho com "Código SKU" não encontrado.');
          setTimeout(() => setImportMsg(''), 4000);
          return;
        }

        let criados = 0;
        let atualizados = 0;
        setSkus(prev => {
          const next = [...prev];
          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[0]) continue;
            const codigoSKU = String(row[0]).trim();
            const curva = String(row[7] ?? 'C').trim().toUpperCase();
            const dados = {
              codigoSKU,
              nomeProduto: String(row[1] ?? '').trim(),
              variacao: String(row[2] ?? '').trim(),
              categoria: String(row[3] ?? '').trim(),
              precoCusto: parseNumeroBR(String(row[4] ?? '0')),
              precoVenda: parseNumeroBR(String(row[5] ?? '0')),
              quantidadeAtual: Math.max(0, Math.round(parseNumeroBR(String(row[6] ?? '0')))),
              curvaABC: (curva === 'A' || curva === 'B' || curva === 'C' ? curva : 'C') as 'A' | 'B' | 'C',
            };
            const idx = next.findIndex(s => s.codigoSKU === codigoSKU);
            if (idx >= 0) {
              next[idx] = { ...next[idx], ...dados };
              atualizados++;
            } else {
              next.push({ id: nextId(next), ...dados });
              criados++;
            }
          }
          return next;
        });
        setImportMsg(`Importação concluída: ${criados} SKU(s) criado(s), ${atualizados} atualizado(s).`);
        setTimeout(() => setImportMsg(''), 5000);
      } catch {
        setImportMsg('Erro ao ler arquivo. Verifique o formato.');
        setTimeout(() => setImportMsg(''), 4000);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  function exportMovimentacoesXLSX() {
    const header = ['Data/Hora', 'Tipo', 'Código SKU', 'Quantidade', 'Motivo', 'Responsável'];
    const rows = movimentacoes.map(m => [
      fmtDataHora(m.dataHora),
      TIPO_MOVIMENTACAO_LABEL[m.tipoMovimentacao],
      m.codigoSKU,
      m.quantidade,
      MOTIVO_LABEL[m.motivo] ?? m.motivo,
      m.usuarioResponsavel,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movimentações');
    XLSX.writeFile(wb, `movimentacoes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleImportMovimentacoesFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const headerIdx = rows.findIndex(r => r && String(r[0] ?? '').toLowerCase().includes('data'));
        if (headerIdx === -1) {
          setImportMsg('Formato inválido: cabeçalho com "Data/Hora" não encontrado.');
          setTimeout(() => setImportMsg(''), 4000);
          return;
        }

        const novas: MovimentacaoEstoque[] = [];
        let id = nextId(movimentacoes);
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0] || !row[2]) continue;
          const quantidade = Math.max(0, Math.round(parseNumeroBR(String(row[3] ?? '0'))));
          if (!quantidade) continue;
          novas.push({
            id: id++,
            tipoMovimentacao: parseTipoMovimentacao(String(row[1] ?? '')),
            codigoSKU: String(row[2]).trim(),
            quantidade,
            dataHora: parseDataHoraBR(String(row[0])),
            motivo: parseMotivo(String(row[4] ?? '')),
            usuarioResponsavel: String(row[5] ?? '').trim(),
          });
        }

        setMovimentacoes(prev => [...novas, ...prev]);
        setSkus(prev => {
          let next = prev;
          for (const m of novas) {
            next = next.map(s => s.codigoSKU === m.codigoSKU
              ? { ...s, quantidadeAtual: Math.max(0, s.quantidadeAtual + (m.tipoMovimentacao === 'entrada' ? m.quantidade : -m.quantidade)) }
              : s);
          }
          return next;
        });
        setImportMsg(`${novas.length} movimentação(ões) importada(s).`);
        setTimeout(() => setImportMsg(''), 5000);
      } catch {
        setImportMsg('Erro ao ler arquivo. Verifique o formato.');
        setTimeout(() => setImportMsg(''), 4000);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  const criticosCount = dadosAlertasEstoque.filter(a => a.statusAlerta === 'critico').length;
  const skuPickerSelecionado = skus.find(s => s.codigoSKU === movForm.codigoSKU);
  const skusFiltrados = skus.filter(s =>
    `${s.codigoSKU} ${s.nomeProduto}`.toLowerCase().includes(skuPickerSearch.toLowerCase())
  );

  return (
    <View className="flex-1 bg-slate-100 dark:bg-gray-950">
      <ModuleHeader title="Estoque e Logística" empresaId={empresaId} empresaName={empresaName} grupoId={grupoId} />

      {Platform.OS === 'web' && (
        <>
          <input ref={skuFileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportSkusFile} />
          <input ref={movFileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportMovimentacoesFile} />
        </>
      )}

      <ScrollView contentContainerStyle={{ padding: isMobile ? 16 : 24, paddingTop: isMobile ? 20 : 28 }}>
        <View style={{ width: '100%', maxWidth: 1100, alignSelf: 'center' }}>

          {/* Abas */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {TABS.map(t => {
              const active = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
                    backgroundColor: active ? '#3b5fe0' : (isDark ? '#1f2937' : '#fff'),
                    borderWidth: 1, borderColor: active ? '#3b5fe0' : (isDark ? '#374151' : '#e2e8f0'),
                  }}
                >
                  <Ionicons name={t.icon as any} size={15} color={active ? '#fff' : (isDark ? '#9ca3af' : '#6b7280')} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : (isDark ? '#e5e7eb' : '#374151') }}>{t.label}</Text>
                  {t.key === 'alertas' && criticosCount > 0 && (
                    <View style={{ backgroundColor: active ? 'rgba(255,255,255,0.25)' : (isDark ? '#7f1d1d' : '#fef2f2'), borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#fff' : '#dc2626' }}>{criticosCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Mensagem de importação */}
          {!!importMsg && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? '#1e3a5f' : '#eff6ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
              <Ionicons name="information-circle-outline" size={16} color="#3b5fe0" />
              <Text style={{ fontSize: 13, color: isDark ? '#e5e7eb' : '#1e3a5f', flex: 1 }}>{importMsg}</Text>
            </View>
          )}

          {/* Conteúdo da aba */}
          {tab === 'skus' && (
            <SKUsSection
              isDark={isDark}
              isMobile={isMobile}
              skus={skus}
              onNew={openNewSkuModal}
              onEdit={openEditSkuModal}
              onDelete={setSkuDeleteTarget}
              onExport={exportSkusXLSX}
              onImport={() => skuFileInputRef.current?.click()}
            />
          )}
          {tab === 'movimentacoes' && (
            <MovimentacoesSection
              isDark={isDark}
              isMobile={isMobile}
              movimentacoes={movimentacoes}
              onNew={openNewMovModal}
              onDelete={setMovDeleteTarget}
              onExport={exportMovimentacoesXLSX}
              onImport={() => movFileInputRef.current?.click()}
            />
          )}
          {tab === 'inventario' && (
            <InventarioSection
              isDark={isDark}
              isMobile={isMobile}
              notas={notasFiscaisEstoque}
              onNovaNota={openNovaNotaEstoqueModal}
            />
          )}
          {tab === 'alertas' && <AlertasSection isDark={isDark} />}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Modal: Novo / Editar SKU */}
      <Modal visible={skuModalVisible} transparent animationType="fade" onRequestClose={() => setSkuModalVisible(false)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 480 }}>
            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-5">
              {skuEditingId != null ? 'Editar SKU' : 'Novo SKU'}
            </Text>

            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Código SKU *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={skuForm.codigoSKU}
                  onChangeText={v => setSkuForm(p => ({ ...p, codigoSKU: v }))}
                  placeholder="SKU-1000"
                  placeholderTextColor={ph}
                  autoCapitalize="characters"
                  autoFocus
                />
              </View>
              <View style={{ width: 160 }}>
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Curva ABC</Text>
                <View className="flex-row gap-2">
                  {(['A', 'B', 'C'] as const).map(c => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setSkuForm(p => ({ ...p, curvaABC: c }))}
                      className={`flex-1 h-11 rounded-lg border items-center justify-center ${
                        skuForm.curvaABC === c
                          ? 'bg-[#3b5fe0] border-[#3b5fe0]'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                      }`}
                      activeOpacity={0.8}
                    >
                      <Text className={`text-sm font-semibold ${skuForm.curvaABC === c ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Nome do Produto *</Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={skuForm.nomeProduto}
                onChangeText={v => setSkuForm(p => ({ ...p, nomeProduto: v }))}
                placeholder="Ex: Cimento CP-II 50kg"
                placeholderTextColor={ph}
              />
            </View>

            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Variação</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={skuForm.variacao}
                  onChangeText={v => setSkuForm(p => ({ ...p, variacao: v }))}
                  placeholder="Ex: Saco 50kg"
                  placeholderTextColor={ph}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Categoria</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={skuForm.categoria}
                  onChangeText={v => setSkuForm(p => ({ ...p, categoria: v }))}
                  placeholder="Ex: Cimento e Argamassa"
                  placeholderTextColor={ph}
                />
              </View>
            </View>

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Preço Custo (R$) *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={skuForm.precoCusto}
                  onChangeText={v => setSkuForm(p => ({ ...p, precoCusto: v }))}
                  placeholder="0,00"
                  placeholderTextColor={ph}
                  keyboardType="decimal-pad"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Preço Venda (R$) *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={skuForm.precoVenda}
                  onChangeText={v => setSkuForm(p => ({ ...p, precoVenda: v }))}
                  placeholder="0,00"
                  placeholderTextColor={ph}
                  keyboardType="decimal-pad"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Qtd. Atual *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={skuForm.quantidadeAtual}
                  onChangeText={v => setSkuForm(p => ({ ...p, quantidadeAtual: v }))}
                  placeholder="0"
                  placeholderTextColor={ph}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {!!skuErro && (
              <View className="flex-row items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2.5 mb-4">
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text className="flex-1 text-xs text-red-600 dark:text-red-400">{skuErro}</Text>
              </View>
            )}

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setSkuModalVisible(false)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center"
                onPress={handleSaveSku}
              >
                <Text className="text-sm font-semibold text-white">{skuEditingId != null ? 'Salvar' : 'Cadastrar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Remover SKU */}
      <Modal visible={!!skuDeleteTarget} transparent animationType="fade" onRequestClose={() => setSkuDeleteTarget(null)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 400 }}>
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 items-center justify-center mb-3">
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
              </View>
              <Text className="text-lg font-bold text-gray-800 dark:text-white">Remover SKU</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
                Tem certeza que deseja remover{' '}
                <Text className="font-bold text-gray-700 dark:text-gray-200">{skuDeleteTarget?.codigoSKU} — {skuDeleteTarget?.nomeProduto}</Text>?
                {' '}Esta ação não pode ser desfeita.
              </Text>
            </View>
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setSkuDeleteTarget(null)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl bg-red-500 items-center justify-center"
                onPress={handleDeleteSku}
              >
                <Text className="text-sm font-semibold text-white">Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Nova Movimentação (Entrada / Saída) */}
      <Modal visible={movModalVisible} transparent animationType="fade" onRequestClose={() => setMovModalVisible(false)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 460 }}>
            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-5">Nova Movimentação</Text>

            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Tipo</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setMovForm(p => ({ ...p, tipoMovimentacao: 'entrada' }))}
                  className={`flex-1 h-11 rounded-lg border items-center justify-center flex-row gap-1.5 ${
                    movForm.tipoMovimentacao === 'entrada' ? 'bg-[#16a34a] border-[#16a34a]' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                  }`}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-down-circle-outline" size={16} color={movForm.tipoMovimentacao === 'entrada' ? '#fff' : (isDark ? '#9ca3af' : '#6b7280')} />
                  <Text className={`text-sm font-semibold ${movForm.tipoMovimentacao === 'entrada' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>Entrada</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMovForm(p => ({ ...p, tipoMovimentacao: 'saida' }))}
                  className={`flex-1 h-11 rounded-lg border items-center justify-center flex-row gap-1.5 ${
                    movForm.tipoMovimentacao === 'saida' ? 'bg-[#dc2626] border-[#dc2626]' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                  }`}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-up-circle-outline" size={16} color={movForm.tipoMovimentacao === 'saida' ? '#fff' : (isDark ? '#9ca3af' : '#6b7280')} />
                  <Text className={`text-sm font-semibold ${movForm.tipoMovimentacao === 'saida' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>Saída</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">SKU *</Text>
              <TouchableOpacity
                onPress={() => { setSkuPickerVisible(true); setSkuPickerSearch(''); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44,
                  borderWidth: 1, borderColor: isDark ? '#4b5563' : '#d1d5db', borderRadius: 8, paddingHorizontal: 12,
                  backgroundColor: isDark ? '#111827' : '#fff',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 14, color: skuPickerSelecionado ? (isDark ? '#f3f4f6' : '#1f2937') : (isDark ? '#4b5563' : '#9ca3af') }} numberOfLines={1}>
                  {skuPickerSelecionado ? `${skuPickerSelecionado.codigoSKU} — ${skuPickerSelecionado.nomeProduto}` : 'Selecionar SKU'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
              {!!skuPickerSelecionado && (
                <Text style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af', marginTop: 4 }}>
                  Estoque atual: {skuPickerSelecionado.quantidadeAtual.toLocaleString('pt-BR')}
                </Text>
              )}
            </View>

            <View className="flex-row gap-3 mb-3">
              <View style={{ width: 130 }}>
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Quantidade *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={movForm.quantidade}
                  onChangeText={v => setMovForm(p => ({ ...p, quantidade: v }))}
                  placeholder="0"
                  placeholderTextColor={ph}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Responsável *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={movForm.usuarioResponsavel}
                  onChangeText={v => setMovForm(p => ({ ...p, usuarioResponsavel: v }))}
                  placeholder="Nome do responsável"
                  placeholderTextColor={ph}
                />
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Motivo</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {MOTIVOS.map(m => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMovForm(p => ({ ...p, motivo: m }))}
                    className={`px-3 h-9 rounded-lg border items-center justify-center ${
                      movForm.motivo === m ? 'bg-[#3b5fe0] border-[#3b5fe0]' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                    }`}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-sm font-medium ${movForm.motivo === m ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>{MOTIVO_LABEL[m]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {!!movErro && (
              <View className="flex-row items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2.5 mb-4">
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text className="flex-1 text-xs text-red-600 dark:text-red-400">{movErro}</Text>
              </View>
            )}

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setMovModalVisible(false)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center"
                onPress={handleSaveMov}
              >
                <Text className="text-sm font-semibold text-white">Registrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Seleção de SKU (usado na Nova Movimentação) */}
      <Modal visible={skuPickerVisible} transparent animationType="fade" onRequestClose={() => setSkuPickerVisible(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          activeOpacity={1}
          onPress={() => setSkuPickerVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 420 }}>
            <View style={{
              backgroundColor: isDark ? '#1f2937' : '#fff',
              borderRadius: 12, overflow: 'hidden',
              shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
            }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 14, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#f1f5f9',
              }}>
                <Ionicons name="search-outline" size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
                <TextInput
                  value={skuPickerSearch}
                  onChangeText={setSkuPickerSearch}
                  placeholder="Pesquisar SKU..."
                  placeholderTextColor={isDark ? '#4b5563' : '#9ca3af'}
                  autoFocus
                  style={{
                    flex: 1, fontSize: 16,
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    backgroundColor: 'transparent',
                    paddingVertical: 2,
                  }}
                />
                {!!skuPickerSearch && (
                  <TouchableOpacity onPress={() => setSkuPickerSearch('')} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                {skusFiltrados.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                      paddingHorizontal: 16, paddingVertical: 12,
                      backgroundColor: movForm.codigoSKU === s.codigoSKU ? (isDark ? '#1e3a5f' : '#eff6ff') : 'transparent',
                      borderBottomWidth: 1, borderBottomColor: isDark ? '#1f2937' : '#f8fafc',
                    }}
                    onPress={() => { setMovForm(p => ({ ...p, codigoSKU: s.codigoSKU })); setSkuPickerVisible(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#e5e7eb' : '#1f2937' }} numberOfLines={1}>{s.codigoSKU} — {s.nomeProduto}</Text>
                      <Text style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280' }}>Estoque atual: {s.quantidadeAtual.toLocaleString('pt-BR')}</Text>
                    </View>
                    {movForm.codigoSKU === s.codigoSKU && (
                      <Ionicons name="checkmark" size={16} color={isDark ? '#60a5fa' : '#3b5fe0'} />
                    )}
                  </TouchableOpacity>
                ))}
                {skusFiltrados.length === 0 && (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, color: isDark ? '#6b7280' : '#9ca3af' }}>Nenhum resultado</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal: Remover Movimentação */}
      <Modal visible={!!movDeleteTarget} transparent animationType="fade" onRequestClose={() => setMovDeleteTarget(null)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 420 }}>
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 items-center justify-center mb-3">
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
              </View>
              <Text className="text-lg font-bold text-gray-800 dark:text-white">Remover Movimentação</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
                Remover esta {movDeleteTarget ? TIPO_MOVIMENTACAO_LABEL[movDeleteTarget.tipoMovimentacao].toLowerCase() : ''} de{' '}
                <Text className="font-bold text-gray-700 dark:text-gray-200">{movDeleteTarget?.quantidade}x {movDeleteTarget?.codigoSKU}</Text>?
                {' '}O estoque do SKU será ajustado de volta.
              </Text>
            </View>
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setMovDeleteTarget(null)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl bg-red-500 items-center justify-center"
                onPress={handleDeleteMov}
              >
                <Text className="text-sm font-semibold text-white">Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Nova Nota Fiscal (entrada/compra — contabiliza no Financeiro) */}
      <Modal visible={notaEstoqueModalVisible} transparent animationType="fade" onRequestClose={() => setNotaEstoqueModalVisible(false)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 480 }}>
            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-5">Nova Nota Fiscal (Compra)</Text>

            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Fornecedor *</Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={notaEstoqueForm.fornecedor}
                onChangeText={v => setNotaEstoqueForm(p => ({ ...p, fornecedor: v }))}
                placeholder="Nome do fornecedor"
                placeholderTextColor={ph}
                autoFocus
              />
            </View>

            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Número NF *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaEstoqueForm.numeroNF}
                  onChangeText={v => setNotaEstoqueForm(p => ({ ...p, numeroNF: v }))}
                  placeholder="000561"
                  placeholderTextColor={ph}
                />
              </View>
              <View style={{ width: 100 }}>
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Total Itens *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaEstoqueForm.totalItens}
                  onChangeText={v => setNotaEstoqueForm(p => ({ ...p, totalItens: v }))}
                  placeholder="0"
                  placeholderTextColor={ph}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Categoria (despesa) *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaEstoqueForm.categoria}
                  onChangeText={v => setNotaEstoqueForm(p => ({ ...p, categoria: v }))}
                  placeholder="Ex: Insumos e Materiais"
                  placeholderTextColor={ph}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Valor (R$) *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaEstoqueForm.valor}
                  onChangeText={v => setNotaEstoqueForm(p => ({ ...p, valor: v }))}
                  placeholder="0,00"
                  placeholderTextColor={ph}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Chave de Acesso</Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={notaEstoqueForm.chaveAcesso}
                onChangeText={v => setNotaEstoqueForm(p => ({ ...p, chaveAcesso: v }))}
                placeholder="44 dígitos (opcional)"
                placeholderTextColor={ph}
              />
            </View>

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Emissão *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaEstoqueForm.dataEmissao}
                  onChangeText={v => setNotaEstoqueForm(p => ({ ...p, dataEmissao: v }))}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={ph}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Vencimento *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaEstoqueForm.dataVencimento}
                  onChangeText={v => setNotaEstoqueForm(p => ({ ...p, dataVencimento: v }))}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={ph}
                />
              </View>
            </View>

            {!!notaEstoqueErro && (
              <View className="flex-row items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2.5 mb-4">
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text className="flex-1 text-xs text-red-600 dark:text-red-400">{notaEstoqueErro}</Text>
              </View>
            )}

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setNotaEstoqueModalVisible(false)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center"
                style={{ opacity: notaEstoqueSalvando ? 0.6 : 1 }}
                disabled={notaEstoqueSalvando}
                onPress={handleSaveNotaEstoque}
              >
                <Text className="text-sm font-semibold text-white">{notaEstoqueSalvando ? 'Salvando...' : 'Cadastrar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
