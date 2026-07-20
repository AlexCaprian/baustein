import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import * as XLSX from 'xlsx';
import { ModuleHeader } from '@/components/layout/module-header';
import { decodeId } from '@/services/idHash';
import { api, NotaFiscal, NotaFiscalInput, ApiCategoriaFinanceira, ApiLancamentoFinanceiro } from '@/services/api';
import {
  STATUS_COLORS,
  TIPO_LANCAMENTO_COLORS,
  TIPO_TRANSACAO_COLORS,
  dadosModelosRelatorio,
  dadosHistoricoRelatorios,
  LancamentoFinanceiro,
  CategoriaFinanceira,
  FluxoCaixaPeriodo,
  TransacaoExtrato,
  dadosExtratoBancario,
  DREItem,
} from '@/services/financeiroMock';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const monoFont = Platform.OS === 'web' ? 'monospace' : undefined;

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
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

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const MESES_COMPLETO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function periodoLabel(iso: string): string {
  const [y, m] = iso.split('-');
  return `${MESES_ABREV[Number(m) - 1]}/${y}`;
}

// Verifica se uma data ISO (YYYY-MM-DD) cai dentro do mês/ano selecionado no filtro.
function noMesAno(iso: string | null, mes: number, ano: number): boolean {
  if (!iso) return false;
  const [y, m] = iso.split('-');
  return Number(y) === ano && Number(m) === mes;
}

// Converte CategoriaFinanceira da API (snake_case) para o formato interno (camelCase).
function apiCatToLocal(c: ApiCategoriaFinanceira): CategoriaFinanceira {
  return { id: c.id, codigo: c.codigo, nome: c.nome, tipo: c.tipo, nivel: c.nivel, parentId: c.parent_id };
}

// Converte LancamentoFinanceiro da API (snake_case) para o formato interno (camelCase).
function apiLancToLocal(l: ApiLancamentoFinanceiro): LancamentoFinanceiro {
  return {
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao,
    categoriaId: l.categoria_id,
    categoria: l.categoria?.nome ?? '',
    valor: l.valor,
    status: l.status,
    fornecedorCliente: l.fornecedor_cliente,
    dataCompetencia: l.data_competencia,
    dataVencimento: l.data_vencimento,
    dataPagamento: l.data_pagamento,
    conciliado: l.conciliado,
    idTransacaoBancaria: l.id_transacao_bancaria,
  };
}

const TIPO_LANCAMENTO_LABEL: Record<'pagar' | 'receber', string> = {
  pagar: 'A Pagar',
  receber: 'A Receber',
};

const STATUS_LANCAMENTO_LABEL: Record<'pago' | 'pendente' | 'atrasado', string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  atrasado: 'Atrasado',
};

const STATUS_RELATORIO_LABEL: Record<'concluido' | 'processando' | 'erro', string> = {
  concluido: 'Concluído',
  processando: 'Processando',
  erro: 'Erro',
};

const TIPO_TRANSACAO_LABEL: Record<'credito' | 'debito', string> = {
  credito: 'Crédito',
  debito: 'Débito',
};

const STATUS_CONCILIACAO_LABEL: Record<'pendente' | 'sucesso', string> = {
  pendente: 'Pendente',
  sucesso: 'Conciliado',
};

const STATUS_NOTA_LABEL: Record<'emitida' | 'cancelada' | 'pendente', string> = {
  emitida: 'Emitida',
  cancelada: 'Cancelada',
  pendente: 'Pendente',
};

// ─── Formulários ────────────────────────────────────────────────────────────

type LancamentoFormState = {
  tipo: 'pagar' | 'receber';
  descricao: string;
  categoria: string;
  valor: string;
  dataVencimento: string;
  status: 'pago' | 'pendente' | 'atrasado';
  fornecedorCliente: string;
};

const EMPTY_LANCAMENTO_FORM: LancamentoFormState = {
  tipo: 'pagar', descricao: '', categoria: '', valor: '', dataVencimento: '', status: 'pendente', fornecedorCliente: '',
};

type NotaFiscalFormState = {
  numero: string;
  serie: string;
  chaveAcesso: string;
  clienteFornecedor: string;
  categoria: string;
  valor: string;
  dataEmissao: string;
  dataVencimento: string;
  status: 'emitida' | 'pendente' | 'cancelada';
};

const EMPTY_NOTA_FISCAL_FORM: NotaFiscalFormState = {
  numero: '', serie: '1', chaveAcesso: '', clienteFornecedor: '', categoria: '', valor: '', dataEmissao: '', dataVencimento: '', status: 'emitida',
};

// ─── Componentes de tabela (mesmo padrão visual da página de Estoque/Ponto) ────

function Badge({ label, color, isDark }: { label: string; color: { bg: string; bgDark: string; text: string }; isDark: boolean }) {
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

// Tabela com colunas elásticas e paginação própria — mesmo cálculo de
// effectiveColWidths usado nas páginas de Ponto e Estoque.
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

function SummaryCard({ label, value, icon, color, isDark }: { label: string; value: string; icon: string; color: string; isDark: boolean }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: isDark ? '#111827' : '#fff', borderWidth: 1, borderColor: isDark ? '#1f2937' : '#e2e8f0', borderRadius: 12, padding: 16 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isDark ? '#1f2937' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <View>
        <Text style={{ fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280' }}>{label}</Text>
        <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#fff' : '#1e2d6e' }}>{value}</Text>
      </View>
    </View>
  );
}

// Filtro de competência (mês/ano) exibido no cabeçalho do módulo — controla
// qual período é usado para filtrar os dados das abas Lançamentos, Fluxo de
// Caixa, Conciliação e DRE.
function MonthYearFilter({ mes, ano, onChange, isDark }: { mes: number; ano: number; onChange: (mes: number, ano: number) => void; isDark: boolean }) {
  const [open, setOpen] = useState(false);
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 11 }, (_, i) => anoAtual - 5 + i);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isDark ? '#1f2937' : '#f1f5f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#e5e7eb' : '#374151' }}>{MESES_COMPLETO[mes - 1]} {ano}</Text>
        <Ionicons name="chevron-down" size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 320 }}>
            <View style={{
              backgroundColor: isDark ? '#1f2937' : '#fff',
              borderRadius: 12, overflow: 'hidden',
              shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
            }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#f1f5f9',
              }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#fff' : '#1e2d6e' }}>Selecionar período</Text>
                <TouchableOpacity onPress={() => setOpen(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row' }}>
                <ScrollView style={{ maxHeight: 280, flex: 1 }} showsVerticalScrollIndicator={false}>
                  {MESES_COMPLETO.map((m, i) => {
                    const selected = i + 1 === mes;
                    return (
                      <TouchableOpacity
                        key={m}
                        onPress={() => onChange(i + 1, ano)}
                        style={{
                          paddingVertical: 10, paddingHorizontal: 16,
                          backgroundColor: selected ? (isDark ? '#1e3a5f' : '#eef1fd') : 'transparent',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 14, fontWeight: selected ? '700' : '400', color: selected ? (isDark ? '#60a5fa' : '#3b5fe0') : (isDark ? '#e5e7eb' : '#374151') }}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={{ width: 1, backgroundColor: isDark ? '#374151' : '#f1f5f9' }} />
                <ScrollView style={{ maxHeight: 280, width: 90 }} showsVerticalScrollIndicator={false}>
                  {anos.map(a => {
                    const selected = a === ano;
                    return (
                      <TouchableOpacity
                        key={a}
                        onPress={() => onChange(mes, a)}
                        style={{
                          paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center',
                          backgroundColor: selected ? (isDark ? '#1e3a5f' : '#eef1fd') : 'transparent',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 14, fontWeight: selected ? '700' : '400', color: selected ? (isDark ? '#60a5fa' : '#3b5fe0') : (isDark ? '#e5e7eb' : '#374151') }}>
                          {a}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── Abas ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'relatorios', label: 'Relatórios', icon: 'bar-chart-outline' },
  { key: 'fluxocaixa', label: 'Fluxo de Caixa', icon: 'trending-up-outline' },
  { key: 'lancamentos', label: 'Contas a Pagar/Receber', icon: 'swap-horizontal-outline' },
  { key: 'conciliacao', label: 'Conciliação Bancária', icon: 'sync-outline' },
  { key: 'notasdre', label: 'Notas e DRE', icon: 'receipt-outline' },
] as const;

type TabKey = typeof TABS[number]['key'];

// ─── 1. Gerar relatórios ────────────────────────────────────────────────────

const MODELO_COLS = [
  { label: 'Título', width: 200 },
  { label: 'Descrição', width: 320 },
  { label: 'Formatos', width: 160 },
  { label: 'Ações', width: 110 },
];

const HISTORICO_COLS = [
  { label: 'Nome', width: 260 },
  { label: 'Data Geração', width: 120 },
  { label: 'Tamanho', width: 100 },
  { label: 'Status', width: 120 },
];

function RelatoriosSection({ isDark, onGerar }: { isDark: boolean; onGerar: (titulo: string) => void }) {
  return (
    <View>
      <SectionTitle title="Modelos de relatório" isDark={isDark} />
      <Table
        cols={MODELO_COLS}
        data={dadosModelosRelatorio}
        isDark={isDark}
        keyExtractor={m => m.id}
        renderRow={(m, _idx, w) => (
          <>
            <CellText width={w[0]} bold isDark={isDark}>{m.titulo}</CellText>
            <CellText width={w[1]} color={isDark ? '#9ca3af' : '#6b7280'} isDark={isDark}>{m.descricao}</CellText>
            <Cell width={w[2]}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {m.formatoDisponivel.map(f => (
                  <View key={f} style={{ backgroundColor: isDark ? '#1f2937' : '#f1f5f9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280' }}>{f}</Text>
                  </View>
                ))}
              </View>
            </Cell>
            <Cell width={w[3]}>
              <ToolbarButton icon="play-outline" label="Gerar" onPress={() => onGerar(m.titulo)} isDark={isDark} primary />
            </Cell>
          </>
        )}
      />

      <SectionTitle title="Histórico de relatórios gerados" isDark={isDark} style={{ marginTop: 24 }} />
      <Table
        cols={HISTORICO_COLS}
        data={dadosHistoricoRelatorios}
        isDark={isDark}
        keyExtractor={r => r.id}
        renderRow={(r, _idx, w) => (
          <>
            <CellText width={w[0]} bold isDark={isDark}>{r.nome}</CellText>
            <CellText width={w[1]} mono isDark={isDark}>{fmtData(r.dataGeracao)}</CellText>
            <CellText width={w[2]} mono isDark={isDark}>{r.tamanho}</CellText>
            <Cell width={w[3]}>
              <Badge label={STATUS_RELATORIO_LABEL[r.status]} color={STATUS_COLORS[r.status]} isDark={isDark} />
            </Cell>
          </>
        )}
      />
    </View>
  );
}

// ─── 2. Contas a pagar / receber ────────────────────────────────────────────

const LANCAMENTO_COLS = [
  { label: 'Descrição', width: 240 },
  { label: 'Categoria', width: 150 },
  { label: 'Tipo', width: 100 },
  { label: 'Valor', width: 120 },
  { label: 'Vencimento', width: 110 },
  { label: 'Status', width: 100 },
  { label: 'Fornecedor/Cliente', width: 200 },
  { label: 'Ações', width: 76 },
];

function LancamentosSection({ isDark, isMobile, lancamentos, onNew, onEdit, onDelete }: {
  isDark: boolean;
  isMobile: boolean;
  lancamentos: LancamentoFinanceiro[];
  onNew: () => void;
  onEdit: (l: LancamentoFinanceiro) => void;
  onDelete: (l: LancamentoFinanceiro) => void;
}) {
  return (
    <View>
      <SectionHeader title="Contas a pagar e a receber" isDark={isDark} isMobile={isMobile}>
        <ToolbarButton icon="add" label="Novo Lançamento" onPress={onNew} isDark={isDark} primary />
      </SectionHeader>
      <Table
        cols={LANCAMENTO_COLS}
        data={lancamentos}
        isDark={isDark}
        keyExtractor={l => l.id}
        renderRow={(l, _idx, w) => {
          const corTipo = TIPO_LANCAMENTO_COLORS[l.tipo];
          const corStatus = STATUS_COLORS[l.status];
          const sinal = l.tipo === 'receber' ? '+' : '-';
          return (
            <>
              <CellText width={w[0]} bold isDark={isDark}>{l.descricao}</CellText>
              <CellText width={w[1]} color={isDark ? '#9ca3af' : '#6b7280'} isDark={isDark}>{l.categoria}</CellText>
              <Cell width={w[2]}>
                <Badge label={TIPO_LANCAMENTO_LABEL[l.tipo]} color={corTipo} isDark={isDark} />
              </Cell>
              <CellText width={w[3]} mono bold color={corTipo.text} isDark={isDark}>{sinal}{fmtMoeda(l.valor)}</CellText>
              <CellText width={w[4]} mono isDark={isDark}>{fmtData(l.dataVencimento)}</CellText>
              <Cell width={w[5]}>
                <Badge label={STATUS_LANCAMENTO_LABEL[l.status]} color={corStatus} isDark={isDark} />
              </Cell>
              <CellText width={w[6]} isDark={isDark}>{l.fornecedorCliente}</CellText>
              <Cell width={w[7]}>
                <RowActions onEdit={() => onEdit(l)} onDelete={() => onDelete(l)} isDark={isDark} />
              </Cell>
            </>
          );
        }}
      />
    </View>
  );
}

// ─── 3. Fluxo de caixa ──────────────────────────────────────────────────────

const FLUXO_COLS = [
  { label: 'Período', width: 120 },
  { label: 'Entradas', width: 140 },
  { label: 'Saídas', width: 140 },
  { label: 'Saldo Acumulado', width: 160 },
];

function FluxoCaixaSection({ isDark, isMobile, lancamentos, filtroMes, filtroAno }: { isDark: boolean; isMobile: boolean; lancamentos: LancamentoFinanceiro[]; filtroMes: number; filtroAno: number }) {
  const filtroChave = `${filtroAno}-${String(filtroMes).padStart(2, '0')}`;

  // Regime de caixa: só entram no fluxo os lançamentos já pagos/recebidos
  // (dataPagamento != null) até o período selecionado (saldo acumulado),
  // agrupados por mês de pagamento.
  const totaisPorMes = new Map<string, { entradas: number; saidas: number }>();
  for (const l of lancamentos) {
    if (!l.dataPagamento) continue;
    const chave = l.dataPagamento.slice(0, 7); // YYYY-MM
    if (chave > filtroChave) continue;
    const totais = totaisPorMes.get(chave) ?? { entradas: 0, saidas: 0 };
    if (l.tipo === 'receber') totais.entradas += l.valor;
    else totais.saidas += l.valor;
    totaisPorMes.set(chave, totais);
  }

  let saldoAcumulado = 0;
  const fluxoPorPeriodo: FluxoCaixaPeriodo[] = [...totaisPorMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, { entradas, saidas }]) => {
      saldoAcumulado += entradas - saidas;
      return { periodo: periodoLabel(`${chave}-01`), entradas, saidas, saldoAcumulado };
    });

  const saldoAtual = fluxoPorPeriodo.length > 0 ? fluxoPorPeriodo[fluxoPorPeriodo.length - 1].saldoAcumulado : 0;
  // Previsão: lançamentos ainda não pagos cujo vencimento cai no período selecionado.
  const previsaoEntradas = lancamentos.filter(l => !l.dataPagamento && l.tipo === 'receber' && noMesAno(l.dataVencimento, filtroMes, filtroAno)).reduce((s, l) => s + l.valor, 0);
  const previsaoSaidas = lancamentos.filter(l => !l.dataPagamento && l.tipo === 'pagar' && noMesAno(l.dataVencimento, filtroMes, filtroAno)).reduce((s, l) => s + l.valor, 0);

  return (
    <View>
      <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12, marginBottom: 20 }}>
        <SummaryCard label="Saldo Atual" value={fmtMoeda(saldoAtual)} icon="wallet-outline" color="#3b5fe0" isDark={isDark} />
        <SummaryCard label="Previsão de Entradas" value={fmtMoeda(previsaoEntradas)} icon="arrow-down-circle-outline" color="#16a34a" isDark={isDark} />
        <SummaryCard label="Previsão de Saídas" value={fmtMoeda(previsaoSaidas)} icon="arrow-up-circle-outline" color="#dc2626" isDark={isDark} />
      </View>

      <SectionTitle title="Fluxo de caixa por período" isDark={isDark} />
      <Table
        cols={FLUXO_COLS}
        data={fluxoPorPeriodo}
        isDark={isDark}
        keyExtractor={f => f.periodo}
        renderRow={(f, _idx, w) => (
          <>
            <CellText width={w[0]} bold isDark={isDark}>{f.periodo}</CellText>
            <CellText width={w[1]} mono color="#16a34a" isDark={isDark}>+{fmtMoeda(f.entradas)}</CellText>
            <CellText width={w[2]} mono color="#dc2626" isDark={isDark}>-{fmtMoeda(f.saidas)}</CellText>
            <CellText width={w[3]} mono bold isDark={isDark}>{fmtMoeda(f.saldoAcumulado)}</CellText>
          </>
        )}
      />
    </View>
  );
}

// ─── 4. Conciliação bancária ────────────────────────────────────────────────

const EXTRATO_COLS = [
  { label: 'Descrição (Banco)', width: 280 },
  { label: 'Data', width: 100 },
  { label: 'Valor', width: 120 },
  { label: 'Tipo', width: 90 },
  { label: 'Status', width: 120 },
  { label: 'Sugestão de Match', width: 220 },
];

function ConciliacaoSection({ isDark, lancamentos, extratos }: { isDark: boolean; lancamentos: LancamentoFinanceiro[]; extratos: TransacaoExtrato[] }) {
  return (
    <View>
      <SectionTitle title="Extrato bancário" isDark={isDark} />
      <Table
        cols={EXTRATO_COLS}
        data={extratos}
        isDark={isDark}
        keyExtractor={t => t.id}
        renderRow={(t, _idx, w) => {
          const corTipo = TIPO_TRANSACAO_COLORS[t.tipo];
          // Lançamento já conciliado via idTransacaoBancaria tem prioridade;
          // caso contrário usa a sugestão automática do extrato mock.
          const match = lancamentos.find(l => l.conciliado && l.idTransacaoBancaria === t.idTransacao);
          const sugestao = match ?? (t.sugestaoMatchId != null ? lancamentos.find(l => l.id === t.sugestaoMatchId) : null);
          const statusConciliacao: 'pendente' | 'sucesso' = match ? 'sucesso' : 'pendente';
          return (
            <>
              <CellText width={w[0]} bold isDark={isDark}>{t.descricaoBanco}</CellText>
              <CellText width={w[1]} mono isDark={isDark}>{fmtData(t.data)}</CellText>
              <CellText width={w[2]} mono bold color={corTipo.text} isDark={isDark}>{fmtMoeda(t.valor)}</CellText>
              <Cell width={w[3]}>
                <Badge label={TIPO_TRANSACAO_LABEL[t.tipo]} color={corTipo} isDark={isDark} />
              </Cell>
              <Cell width={w[4]}>
                <Badge label={STATUS_CONCILIACAO_LABEL[statusConciliacao]} color={STATUS_COLORS[statusConciliacao]} isDark={isDark} />
              </Cell>
              <CellText width={w[5]} color={isDark ? '#9ca3af' : '#6b7280'} isDark={isDark}>{sugestao ? sugestao.descricao : '—'}</CellText>
            </>
          );
        }}
      />
    </View>
  );
}

// ─── 5. Emissão de notas e DRE ──────────────────────────────────────────────

const NOTA_SAIDA_COLS = [
  { label: 'Número', width: 100 },
  { label: 'Série', width: 70 },
  { label: 'Cliente', width: 220 },
  { label: 'Categoria', width: 160 },
  { label: 'Valor', width: 120 },
  { label: 'Emissão', width: 100 },
  { label: 'Vencimento', width: 100 },
  { label: 'Status', width: 100 },
  { label: 'Ações', width: 76 },
];

const NOTA_ENTRADA_COLS = [
  { label: 'Número', width: 100 },
  { label: 'Série', width: 70 },
  { label: 'Fornecedor', width: 220 },
  { label: 'Categoria', width: 160 },
  { label: 'Valor', width: 120 },
  { label: 'Emissão', width: 100 },
  { label: 'Vencimento', width: 100 },
  { label: 'Status', width: 100 },
  { label: 'Ações', width: 76 },
];


function NotasFiscaisSection({ title, cols, notas, isDark, isMobile, onNew, onEdit, onDelete, onExport, onImport }: {
  title: string;
  cols: { label: string; width: number }[];
  notas: NotaFiscal[];
  isDark: boolean;
  isMobile: boolean;
  onNew: () => void;
  onEdit: (n: NotaFiscal) => void;
  onDelete: (n: NotaFiscal) => void;
  onExport: () => void;
  onImport: () => void;
}) {
  return (
    <View style={{ marginBottom: 28 }}>
      <SectionHeader title={title} isDark={isDark} isMobile={isMobile}>
        {Platform.OS === 'web' && <ToolbarButton icon="cloud-upload-outline" label="Importar" onPress={onImport} isDark={isDark} />}
        <ToolbarButton icon="download-outline" label="Exportar" onPress={onExport} isDark={isDark} />
        <ToolbarButton icon="add" label="Nova Nota Fiscal" onPress={onNew} isDark={isDark} primary />
      </SectionHeader>
      <Table
        cols={cols}
        data={notas}
        isDark={isDark}
        keyExtractor={n => n.id}
        renderRow={(n, _idx, w) => (
          <>
            <CellText width={w[0]} mono isDark={isDark}>{n.numero}</CellText>
            <CellText width={w[1]} mono isDark={isDark}>{n.serie}</CellText>
            <CellText width={w[2]} bold isDark={isDark}>{n.cliente_fornecedor}</CellText>
            <CellText width={w[3]} color={isDark ? '#9ca3af' : '#6b7280'} isDark={isDark}>{n.categoria_nome}</CellText>
            <CellText width={w[4]} mono isDark={isDark}>{fmtMoeda(n.valor)}</CellText>
            <CellText width={w[5]} mono isDark={isDark}>{fmtData(n.data_emissao)}</CellText>
            <CellText width={w[6]} mono isDark={isDark}>{fmtData(n.data_vencimento)}</CellText>
            <Cell width={w[7]}>
              <Badge label={STATUS_NOTA_LABEL[n.status]} color={STATUS_COLORS[n.status]} isDark={isDark} />
            </Cell>
            <Cell width={w[8]}>
              <RowActions onEdit={() => onEdit(n)} onDelete={() => onDelete(n)} isDark={isDark} />
            </Cell>
          </>
        )}
      />
    </View>
  );
}

// Soma lançamentos por categoria (regime de competência), seguindo a
// hierarquia parentId/nivel para montar as linhas do DRE — incluindo
// subtotais/totais ('resultado') que não existem como categoria de lançamento.
function computeDRE(lancamentos: LancamentoFinanceiro[], categorias: CategoriaFinanceira[]): DREItem[] {
  function totalCategoria(cat: CategoriaFinanceira): number {
    const filhos = categorias.filter(c => c.parentId === cat.id);
    if (filhos.length === 0) {
      const soma = lancamentos.filter(l => l.categoriaId === cat.id).reduce((s, l) => s + l.valor, 0);
      return cat.tipo === 'receita' ? soma : -soma;
    }
    return filhos.reduce((s, f) => s + totalCategoria(f), 0);
  }

  const receitaBruta = categorias.find(c => c.codigo === '3.1');
  const deducoes = categorias.find(c => c.codigo === '3.2');
  const custos = categorias.find(c => c.codigo === '3.4');
  const despesasAdm = categorias.find(c => c.codigo === '3.5');
  if (!receitaBruta || !deducoes || !custos || !despesasAdm) return [];

  const valorReceitaBruta = totalCategoria(receitaBruta);
  const valorDeducoes = totalCategoria(deducoes);
  const valorReceitaLiquida = valorReceitaBruta + valorDeducoes;
  const valorCustos = totalCategoria(custos);
  const valorDespesasAdm = totalCategoria(despesasAdm);
  const valorResultado = valorReceitaLiquida + valorCustos + valorDespesasAdm;

  let id = 0;
  const itens: DREItem[] = [];
  const addGrupo = (cat: CategoriaFinanceira, valor: number, descricao?: string) => {
    itens.push({ id: ++id, codigo: cat.codigo, descricao: descricao ?? cat.nome, valor, tipo: cat.tipo, nivel: cat.nivel });
  };
  const addSubitens = (pai: CategoriaFinanceira) => {
    for (const sub of categorias.filter(c => c.parentId === pai.id)) {
      itens.push({ id: ++id, codigo: sub.codigo, descricao: sub.nome, valor: totalCategoria(sub), tipo: sub.tipo, nivel: sub.nivel });
    }
  };

  addGrupo(receitaBruta, valorReceitaBruta);
  addSubitens(receitaBruta);
  addGrupo(deducoes, valorDeducoes, `(-) ${deducoes.nome}`);
  itens.push({ id: ++id, codigo: '3.3', descricao: '(=) Receita Líquida', valor: valorReceitaLiquida, tipo: 'resultado', nivel: 0 });
  addGrupo(custos, valorCustos, `(-) ${custos.nome}`);
  addSubitens(custos);
  addGrupo(despesasAdm, valorDespesasAdm, `(-) ${despesasAdm.nome}`);
  addSubitens(despesasAdm);
  itens.push({ id: ++id, codigo: '3.6', descricao: '(=) Resultado do Exercício', valor: valorResultado, tipo: 'resultado', nivel: 0 });

  return itens;
}

function NotasDRESection({ isDark, isMobile, lancamentos, categorias, notasSaida, notasEntrada, onNew, onEdit, onDelete, onExport, onImport }: {
  isDark: boolean;
  isMobile: boolean;
  lancamentos: LancamentoFinanceiro[];
  categorias: CategoriaFinanceira[];
  notasSaida: NotaFiscal[];
  notasEntrada: NotaFiscal[];
  onNew: (tipo: 'saida' | 'entrada') => void;
  onEdit: (n: NotaFiscal) => void;
  onDelete: (n: NotaFiscal) => void;
  onExport: (tipo: 'saida' | 'entrada') => void;
  onImport: (tipo: 'saida' | 'entrada') => void;
}) {
  const dre = computeDRE(lancamentos, categorias);
  return (
    <View>
      <NotasFiscaisSection
        title="Notas Fiscais de Saída (Clientes — A Receber)"
        cols={NOTA_SAIDA_COLS}
        notas={notasSaida}
        isDark={isDark}
        isMobile={isMobile}
        onNew={() => onNew('saida')}
        onEdit={onEdit}
        onDelete={onDelete}
        onExport={() => onExport('saida')}
        onImport={() => onImport('saida')}
      />

      <NotasFiscaisSection
        title="Notas Fiscais de Entrada (Compras — A Pagar)"
        cols={NOTA_ENTRADA_COLS}
        notas={notasEntrada}
        isDark={isDark}
        isMobile={isMobile}
        onNew={() => onNew('entrada')}
        onEdit={onEdit}
        onDelete={onDelete}
        onExport={() => onExport('entrada')}
        onImport={() => onImport('entrada')}
      />

      <SectionTitle title="DRE — Demonstrativo de Resultado do Exercício" isDark={isDark} />
      <View style={{ backgroundColor: isDark ? '#111827' : '#fff', borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#1f2937' : '#e2e8f0', overflow: 'hidden' }}>
        {dre.map((item, idx) => {
          const cor = item.tipo === 'receita' ? '#16a34a' : item.tipo === 'despesa' ? '#dc2626' : (isDark ? '#fff' : '#1e2d6e');
          return (
            <View key={item.id} style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              paddingVertical: 10, paddingHorizontal: 14 + item.nivel * 20,
              backgroundColor: idx % 2 === 0 ? 'transparent' : (isDark ? '#0a0e1a' : '#fafafa'),
              borderBottomWidth: idx === dre.length - 1 ? 0 : 1, borderBottomColor: isDark ? '#1f2937' : '#f1f5f9',
            }}>
              <Text style={{ fontSize: item.nivel === 0 ? 14 : 13, fontWeight: item.tipo === 'resultado' ? '700' : '500', color: item.tipo === 'resultado' ? cor : (isDark ? '#e5e7eb' : '#374151') }}>
                {item.codigo} {item.descricao}
              </Text>
              <Text style={{ fontSize: 14, fontFamily: monoFont, fontWeight: item.tipo === 'resultado' ? '700' : '600', color: cor }}>
                {fmtMoeda(item.valor)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Tela principal ─────────────────────────────────────────────────────────

export default function FinanceiroScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const params = useLocalSearchParams<{ empresaId: string; empresaName: string; grupoId: string }>();
  const empresaId = decodeId(params.empresaId);
  const empresaName = params.empresaName ?? '';
  const grupoId = decodeId(params.grupoId);

  const [tab, setTab] = useState<TabKey>('relatorios');
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [infoMsg, setInfoMsg] = useState('');

  // Filtro de competência (mês/ano) do cabeçalho — filtra os dados exibidos
  // nas abas Lançamentos, Fluxo de Caixa, Conciliação e Notas/DRE.
  const [filtroMes, setFiltroMes] = useState(6);
  const [filtroAno, setFiltroAno] = useState(2026);

  const ph = isDark ? '#4b5563' : '#bbb';

  function showInfo(msg: string) {
    setInfoMsg(msg);
    setTimeout(() => setInfoMsg(''), 4000);
  }

  // ── Lançamentos: criar / editar / remover ─────────────────────────────────

  const [lancamentoModalVisible, setLancamentoModalVisible] = useState(false);
  const [lancamentoEditingId, setLancamentoEditingId] = useState<number | null>(null);
  const [lancamentoForm, setLancamentoForm] = useState<LancamentoFormState>(EMPTY_LANCAMENTO_FORM);
  const [lancamentoErro, setLancamentoErro] = useState('');
  const [lancamentoSalvando, setLancamentoSalvando] = useState(false);
  const [lancamentoDeleteTarget, setLancamentoDeleteTarget] = useState<LancamentoFinanceiro | null>(null);

  function openNewLancamentoModal() {
    setLancamentoEditingId(null);
    setLancamentoForm(EMPTY_LANCAMENTO_FORM);
    setLancamentoErro('');
    setLancamentoModalVisible(true);
  }

  function openEditLancamentoModal(l: LancamentoFinanceiro) {
    setLancamentoEditingId(l.id);
    setLancamentoForm({
      tipo: l.tipo,
      descricao: l.descricao,
      categoria: l.categoria,
      valor: String(l.valor),
      dataVencimento: fmtData(l.dataVencimento),
      status: l.status,
      fornecedorCliente: l.fornecedorCliente,
    });
    setLancamentoErro('');
    setLancamentoModalVisible(true);
  }

  async function handleSaveLancamento() {
    const f = lancamentoForm;
    if (!f.descricao.trim() || !f.categoria.trim() || !f.valor.trim() || !f.dataVencimento.trim() || !f.fornecedorCliente.trim()) {
      setLancamentoErro('Preencha todos os campos obrigatórios.');
      return;
    }
    const valor = parseNumeroBR(f.valor);
    if (!valor || valor <= 0) {
      setLancamentoErro('Informe um valor válido.');
      return;
    }
    const categoriaNome = f.categoria.trim();
    const dataVencimento = parseDataBR(f.dataVencimento);
    const categoriaEncontrada = categorias.find(c => c.nome.toLowerCase() === categoriaNome.toLowerCase());
    const categoriaCodigo = categoriaEncontrada?.codigo ?? (f.tipo === 'receber' ? '3.1.9' : '3.5.9');

    const dados = {
      empresa_id: empresaId,
      categoria_codigo: categoriaCodigo,
      descricao: f.descricao.trim(),
      fornecedor_cliente: f.fornecedorCliente.trim(),
      valor,
      tipo: f.tipo,
      status: f.status,
      data_vencimento: dataVencimento,
      data_pagamento: f.status === 'pago' ? dataVencimento : null,
    };

    setLancamentoSalvando(true);
    try {
      if (lancamentoEditingId != null) {
        await api.lancamentos.update(lancamentoEditingId, dados);
      } else {
        await api.lancamentos.create(dados);
      }
      setLancamentoModalVisible(false);
      await loadLancamentos();
      showInfo(lancamentoEditingId != null ? 'Lançamento atualizado.' : 'Lançamento cadastrado.');
    } catch (e: any) {
      setLancamentoErro(e.message ?? 'Erro ao salvar lançamento.');
    } finally {
      setLancamentoSalvando(false);
    }
  }

  async function handleDeleteLancamento() {
    if (!lancamentoDeleteTarget) return;
    const target = lancamentoDeleteTarget;
    setLancamentoDeleteTarget(null);
    try {
      await api.lancamentos.delete(target.id);
      await loadLancamentos();
      showInfo('Lançamento removido.');
    } catch (e: any) {
      showInfo(e.message ?? 'Erro ao remover lançamento.');
    }
  }

  // ── Lançamentos e categorias: carregar do backend ────────────────────────

  async function loadLancamentos() {
    if (!empresaId) return;
    try {
      const res = await api.lancamentos.list(empresaId);
      setLancamentos(res.lancamentos.map(apiLancToLocal));
    } catch {
      // backend offline — mantém estado atual
    }
  }

  async function loadCategorias() {
    if (!empresaId) return;
    try {
      const res = await api.categorias.list(empresaId);
      setCategorias(res.categorias.map(apiCatToLocal));
    } catch {
      // backend offline
    }
  }

  // ── Notas Fiscais: carregar do backend ───────────────────────────────────

  const [notasSaida, setNotasSaida] = useState<NotaFiscal[]>([]);
  const [notasEntrada, setNotasEntrada] = useState<NotaFiscal[]>([]);

  async function loadNotasFiscais() {
    if (!empresaId) return;
    try {
      const [resSaida, resEntrada] = await Promise.all([
        api.notasFiscais.list(empresaId, 'saida'),
        api.notasFiscais.list(empresaId, 'entrada'),
      ]);
      setNotasSaida(resSaida.notas);
      setNotasEntrada(resEntrada.notas);
    } catch {
      // backend offline
    }
  }

  useEffect(() => {
    loadCategorias();
    loadLancamentos();
    loadNotasFiscais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  // ── Notas Fiscais: criar / editar / remover ───────────────────────────────

  const [notaModalVisible, setNotaModalVisible] = useState(false);
  const [notaModalTipo, setNotaModalTipo] = useState<'saida' | 'entrada'>('saida');
  const [notaEditing, setNotaEditing] = useState<NotaFiscal | null>(null);
  const [notaForm, setNotaForm] = useState<NotaFiscalFormState>(EMPTY_NOTA_FISCAL_FORM);
  const [notaErro, setNotaErro] = useState('');
  const [notaSalvando, setNotaSalvando] = useState(false);
  const [notaDeleteTarget, setNotaDeleteTarget] = useState<NotaFiscal | null>(null);

  function openNewNotaModal(tipo: 'saida' | 'entrada') {
    setNotaModalTipo(tipo);
    setNotaEditing(null);
    setNotaForm(EMPTY_NOTA_FISCAL_FORM);
    setNotaErro('');
    setNotaModalVisible(true);
  }

  function openEditNotaModal(n: NotaFiscal) {
    setNotaModalTipo(n.tipo);
    setNotaEditing(n);
    setNotaForm({
      numero: n.numero,
      serie: n.serie,
      chaveAcesso: n.chave_acesso,
      clienteFornecedor: n.cliente_fornecedor,
      categoria: n.categoria_nome,
      valor: String(n.valor),
      dataEmissao: fmtData(n.data_emissao),
      dataVencimento: fmtData(n.data_vencimento),
      status: n.status,
    });
    setNotaErro('');
    setNotaModalVisible(true);
  }

  async function handleSaveNota() {
    const f = notaForm;
    if (!f.numero.trim() || !f.clienteFornecedor.trim() || !f.categoria.trim() || !f.valor.trim() || !f.dataEmissao.trim() || !f.dataVencimento.trim()) {
      setNotaErro('Preencha todos os campos obrigatórios.');
      return;
    }
    const valor = parseNumeroBR(f.valor);
    if (!valor || valor <= 0) {
      setNotaErro('Informe um valor válido.');
      return;
    }
    const categoriaEncontrada = categorias.find(c => c.nome.toLowerCase() === f.categoria.trim().toLowerCase());
    const categoriaCodigo = categoriaEncontrada?.codigo ?? (notaModalTipo === 'saida' ? '3.1.9' : '3.5.9');

    const dados: NotaFiscalInput = {
      empresa_id: empresaId,
      tipo: notaModalTipo,
      numero: f.numero.trim(),
      serie: f.serie.trim() || '1',
      chave_acesso: f.chaveAcesso.trim(),
      cliente_fornecedor: f.clienteFornecedor.trim(),
      categoria_codigo: categoriaCodigo,
      valor,
      data_emissao: parseDataBR(f.dataEmissao),
      data_vencimento: parseDataBR(f.dataVencimento),
      status: f.status,
    };

    setNotaSalvando(true);
    try {
      if (notaEditing) {
        await api.notasFiscais.update(notaEditing.id, dados);
      } else {
        await api.notasFiscais.create(dados);
      }
      setNotaModalVisible(false);
      await Promise.all([loadNotasFiscais(), loadLancamentos()]);
      showInfo(notaEditing ? 'Nota fiscal atualizada com sucesso.' : 'Nota fiscal cadastrada com sucesso.');
    } catch {
      setNotaErro('Erro ao salvar nota fiscal. Verifique a conexão com o servidor.');
    } finally {
      setNotaSalvando(false);
    }
  }

  async function handleDeleteNota() {
    if (!notaDeleteTarget) return;
    try {
      await api.notasFiscais.delete(notaDeleteTarget.id);
      setNotaDeleteTarget(null);
      await Promise.all([loadNotasFiscais(), loadLancamentos()]);
      showInfo('Nota fiscal removida com sucesso.');
    } catch {
      setNotaDeleteTarget(null);
      showInfo('Erro ao remover nota fiscal. Verifique a conexão com o servidor.');
    }
  }

  // ── Notas Fiscais: exportar / importar XLSX ───────────────────────────────

  const notaSaidaFileInputRef = useRef<HTMLInputElement | null>(null);
  const notaEntradaFileInputRef = useRef<HTMLInputElement | null>(null);

  function exportNotasFiscaisXLSX(tipo: 'saida' | 'entrada') {
    const notas = tipo === 'saida' ? notasSaida : notasEntrada;
    const header = ['Número', 'Série', 'Chave de Acesso', tipo === 'saida' ? 'Cliente' : 'Fornecedor', 'Categoria', 'Valor', 'Data Emissão', 'Data Vencimento', 'Status'];
    const rows = notas.map(n => [n.numero, n.serie, n.chave_acesso, n.cliente_fornecedor, n.categoria_nome, n.valor, fmtData(n.data_emissao), fmtData(n.data_vencimento), STATUS_NOTA_LABEL[n.status]]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tipo === 'saida' ? 'NF Saída' : 'NF Entrada');
    XLSX.writeFile(wb, `notas_fiscais_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleImportNotasFiscaisFile(tipo: 'saida' | 'entrada', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const headerIdx = rows.findIndex(r => r && String(r[0] ?? '').toLowerCase().includes('número'));
        if (headerIdx === -1) {
          showInfo('Formato inválido: cabeçalho com "Número" não encontrado.');
          return;
        }

        let criadas = 0;
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0]) continue;
          const categoriaNome = String(row[4] ?? '').trim();
          const categoriaEncontrada = categorias.find(c => c.nome.toLowerCase() === categoriaNome.toLowerCase());
          const dados: NotaFiscalInput = {
            empresa_id: empresaId,
            tipo,
            numero: String(row[0]).trim(),
            serie: String(row[1] ?? '1').trim() || '1',
            chave_acesso: String(row[2] ?? '').trim(),
            cliente_fornecedor: String(row[3] ?? '').trim(),
            categoria_codigo: categoriaEncontrada?.codigo ?? (tipo === 'saida' ? '3.1.9' : '3.5.9'),
            valor: parseNumeroBR(String(row[5] ?? '0')),
            data_emissao: parseDataBR(String(row[6] ?? '')),
            data_vencimento: parseDataBR(String(row[7] ?? '')),
            status: 'emitida',
          };
          if (!dados.numero || !dados.cliente_fornecedor || !dados.valor || dados.valor <= 0) continue;
          try {
            await api.notasFiscais.create(dados);
            criadas++;
          } catch {
            // ignora linhas com erro e continua a importação
          }
        }
        await loadNotasFiscais();
        showInfo(`${criadas} nota(s) fiscal(is) importada(s).`);
      } catch {
        showInfo('Erro ao ler arquivo. Verifique o formato.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  // Datasets filtrados pelo período selecionado (mês/ano), um por aba,
  // conforme o campo de data relevante para cada uma.
  const lancamentosDoMes = lancamentos.filter(l => noMesAno(l.dataVencimento, filtroMes, filtroAno));
  const lancamentosCompetenciaDoMes = lancamentos.filter(l => noMesAno(l.dataCompetencia, filtroMes, filtroAno));
  const extratoDoMes = dadosExtratoBancario.filter(t => noMesAno(t.data, filtroMes, filtroAno));

  const atrasadosCount = lancamentosDoMes.filter(l => l.status === 'atrasado').length;

  return (
    <View className="flex-1 bg-slate-100 dark:bg-gray-950">
      <ModuleHeader
        title="Financeiro"
        empresaId={empresaId}
        empresaName={empresaName}
        grupoId={grupoId}
        titleBarRight={
          <MonthYearFilter
            mes={filtroMes}
            ano={filtroAno}
            onChange={(mes, ano) => { setFiltroMes(mes); setFiltroAno(ano); }}
            isDark={isDark}
          />
        }
      />

      {Platform.OS === 'web' && (
        <>
          <input ref={notaSaidaFileInputRef as any} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => handleImportNotasFiscaisFile('saida', e)} />
          <input ref={notaEntradaFileInputRef as any} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => handleImportNotasFiscaisFile('entrada', e)} />
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
                  {t.key === 'lancamentos' && atrasadosCount > 0 && (
                    <View style={{ backgroundColor: active ? 'rgba(255,255,255,0.25)' : (isDark ? '#7f1d1d' : '#fef2f2'), borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: active ? '#fff' : '#dc2626' }}>{atrasadosCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Mensagem informativa */}
          {!!infoMsg && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: isDark ? '#1e3a5f' : '#eff6ff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
              <Ionicons name="information-circle-outline" size={16} color="#3b5fe0" />
              <Text style={{ fontSize: 13, color: isDark ? '#e5e7eb' : '#1e3a5f', flex: 1 }}>{infoMsg}</Text>
            </View>
          )}

          {/* Conteúdo da aba */}
          {tab === 'relatorios' && (
            <RelatoriosSection
              isDark={isDark}
              onGerar={(titulo) => showInfo(`Geração do relatório "${titulo}" estará disponível em breve.`)}
            />
          )}
          {tab === 'lancamentos' && (
            <LancamentosSection
              isDark={isDark}
              isMobile={isMobile}
              lancamentos={lancamentosDoMes}
              onNew={openNewLancamentoModal}
              onEdit={openEditLancamentoModal}
              onDelete={setLancamentoDeleteTarget}
            />
          )}
          {tab === 'fluxocaixa' && <FluxoCaixaSection isDark={isDark} isMobile={isMobile} lancamentos={lancamentos} filtroMes={filtroMes} filtroAno={filtroAno} />}
          {tab === 'conciliacao' && <ConciliacaoSection isDark={isDark} lancamentos={lancamentos} extratos={extratoDoMes} />}
          {tab === 'notasdre' && (
            <NotasDRESection
              isDark={isDark}
              isMobile={isMobile}
              lancamentos={lancamentosCompetenciaDoMes}
              categorias={categorias}
              notasSaida={notasSaida}
              notasEntrada={notasEntrada}
              onNew={openNewNotaModal}
              onEdit={openEditNotaModal}
              onDelete={setNotaDeleteTarget}
              onExport={exportNotasFiscaisXLSX}
              onImport={(tipo) => (tipo === 'saida' ? notaSaidaFileInputRef : notaEntradaFileInputRef).current?.click()}
            />
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Modal: Novo / Editar Lançamento */}
      <Modal visible={lancamentoModalVisible} transparent animationType="fade" onRequestClose={() => setLancamentoModalVisible(false)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 480 }}>
            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-5">
              {lancamentoEditingId != null ? 'Editar Lançamento' : 'Novo Lançamento'}
            </Text>

            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Tipo</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setLancamentoForm(p => ({ ...p, tipo: 'pagar' }))}
                  className={`flex-1 h-11 rounded-lg border items-center justify-center flex-row gap-1.5 ${
                    lancamentoForm.tipo === 'pagar' ? 'bg-[#dc2626] border-[#dc2626]' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                  }`}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-up-circle-outline" size={16} color={lancamentoForm.tipo === 'pagar' ? '#fff' : (isDark ? '#9ca3af' : '#6b7280')} />
                  <Text className={`text-sm font-semibold ${lancamentoForm.tipo === 'pagar' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>A Pagar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLancamentoForm(p => ({ ...p, tipo: 'receber' }))}
                  className={`flex-1 h-11 rounded-lg border items-center justify-center flex-row gap-1.5 ${
                    lancamentoForm.tipo === 'receber' ? 'bg-[#16a34a] border-[#16a34a]' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                  }`}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-down-circle-outline" size={16} color={lancamentoForm.tipo === 'receber' ? '#fff' : (isDark ? '#9ca3af' : '#6b7280')} />
                  <Text className={`text-sm font-semibold ${lancamentoForm.tipo === 'receber' ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>A Receber</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Descrição *</Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={lancamentoForm.descricao}
                onChangeText={v => setLancamentoForm(p => ({ ...p, descricao: v }))}
                placeholder="Ex: Aluguel - Galpão Matriz"
                placeholderTextColor={ph}
                autoFocus
              />
            </View>

            <View className="flex-row gap-3 mb-3">
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Categoria *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={lancamentoForm.categoria}
                  onChangeText={v => setLancamentoForm(p => ({ ...p, categoria: v }))}
                  placeholder="Ex: Infraestrutura"
                  placeholderTextColor={ph}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Fornecedor/Cliente *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={lancamentoForm.fornecedorCliente}
                  onChangeText={v => setLancamentoForm(p => ({ ...p, fornecedorCliente: v }))}
                  placeholder="Nome do fornecedor ou cliente"
                  placeholderTextColor={ph}
                />
              </View>
            </View>

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Valor (R$) *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={lancamentoForm.valor}
                  onChangeText={v => setLancamentoForm(p => ({ ...p, valor: v }))}
                  placeholder="0,00"
                  placeholderTextColor={ph}
                  keyboardType="decimal-pad"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Vencimento *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={lancamentoForm.dataVencimento}
                  onChangeText={v => setLancamentoForm(p => ({ ...p, dataVencimento: v }))}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={ph}
                />
              </View>
              <View style={{ width: 140 }}>
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Status</Text>
                <View className="flex-row gap-1">
                  {(['pendente', 'pago', 'atrasado'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setLancamentoForm(p => ({ ...p, status: s }))}
                      className={`flex-1 h-11 rounded-lg border items-center justify-center ${
                        lancamentoForm.status === s
                          ? 'bg-[#3b5fe0] border-[#3b5fe0]'
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                      }`}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={s === 'pago' ? 'checkmark' : s === 'atrasado' ? 'alert' : 'time-outline'}
                        size={16}
                        color={lancamentoForm.status === s ? '#fff' : (isDark ? '#9ca3af' : '#6b7280')}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', marginTop: 4 }}>
                  {STATUS_LANCAMENTO_LABEL[lancamentoForm.status]}
                </Text>
              </View>
            </View>

            {!!lancamentoErro && (
              <View className="flex-row items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2.5 mb-4">
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text className="flex-1 text-xs text-red-600 dark:text-red-400">{lancamentoErro}</Text>
              </View>
            )}

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setLancamentoModalVisible(false)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center"
                style={{ opacity: lancamentoSalvando ? 0.6 : 1 }}
                disabled={lancamentoSalvando}
                onPress={handleSaveLancamento}
              >
                <Text className="text-sm font-semibold text-white">
                  {lancamentoSalvando ? 'Salvando...' : lancamentoEditingId != null ? 'Salvar' : 'Cadastrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Remover Lançamento */}
      <Modal visible={!!lancamentoDeleteTarget} transparent animationType="fade" onRequestClose={() => setLancamentoDeleteTarget(null)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 400 }}>
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 items-center justify-center mb-3">
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
              </View>
              <Text className="text-lg font-bold text-gray-800 dark:text-white">Remover Lançamento</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
                Tem certeza que deseja remover{' '}
                <Text className="font-bold text-gray-700 dark:text-gray-200">{lancamentoDeleteTarget?.descricao}</Text>?
                {' '}Esta ação não pode ser desfeita.
              </Text>
            </View>
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setLancamentoDeleteTarget(null)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl bg-red-500 items-center justify-center"
                onPress={handleDeleteLancamento}
              >
                <Text className="text-sm font-semibold text-white">Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Nova / Editar Nota Fiscal */}
      <Modal visible={notaModalVisible} transparent animationType="fade" onRequestClose={() => setNotaModalVisible(false)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 480 }}>
            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-5">
              {notaEditing ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'} — {notaModalTipo === 'saida' ? 'Saída (Venda)' : 'Entrada (Compra)'}
            </Text>

            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                {notaModalTipo === 'saida' ? 'Cliente *' : 'Fornecedor *'}
              </Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={notaForm.clienteFornecedor}
                onChangeText={v => setNotaForm(p => ({ ...p, clienteFornecedor: v }))}
                placeholder={notaModalTipo === 'saida' ? 'Nome do cliente' : 'Nome do fornecedor'}
                placeholderTextColor={ph}
                autoFocus
              />
            </View>

            <View className="flex-row gap-3 mb-3">
              <View style={{ width: 110 }}>
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Número *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaForm.numero}
                  onChangeText={v => setNotaForm(p => ({ ...p, numero: v }))}
                  placeholder="000001"
                  placeholderTextColor={ph}
                />
              </View>
              <View style={{ width: 80 }}>
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Série</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaForm.serie}
                  onChangeText={v => setNotaForm(p => ({ ...p, serie: v }))}
                  placeholder="1"
                  placeholderTextColor={ph}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Categoria *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaForm.categoria}
                  onChangeText={v => setNotaForm(p => ({ ...p, categoria: v }))}
                  placeholder={notaModalTipo === 'saida' ? 'Ex: Vendas de Produtos' : 'Ex: Compra de Insumos'}
                  placeholderTextColor={ph}
                />
              </View>
            </View>

            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Chave de Acesso</Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={notaForm.chaveAcesso}
                onChangeText={v => setNotaForm(p => ({ ...p, chaveAcesso: v }))}
                placeholder="44 dígitos (opcional)"
                placeholderTextColor={ph}
              />
            </View>

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Valor (R$) *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaForm.valor}
                  onChangeText={v => setNotaForm(p => ({ ...p, valor: v }))}
                  placeholder="0,00"
                  placeholderTextColor={ph}
                  keyboardType="decimal-pad"
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Emissão *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaForm.dataEmissao}
                  onChangeText={v => setNotaForm(p => ({ ...p, dataEmissao: v }))}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={ph}
                />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Vencimento *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={notaForm.dataVencimento}
                  onChangeText={v => setNotaForm(p => ({ ...p, dataVencimento: v }))}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={ph}
                />
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Status</Text>
              <View className="flex-row gap-2">
                {(['emitida', 'pendente', 'cancelada'] as const).map(s => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setNotaForm(p => ({ ...p, status: s }))}
                    className={`flex-1 h-11 rounded-lg border items-center justify-center flex-row gap-1.5 ${
                      notaForm.status === s ? 'bg-[#3b5fe0] border-[#3b5fe0]' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                    }`}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={s === 'emitida' ? 'checkmark-circle-outline' : s === 'cancelada' ? 'close-circle-outline' : 'time-outline'}
                      size={16}
                      color={notaForm.status === s ? '#fff' : (isDark ? '#9ca3af' : '#6b7280')}
                    />
                    <Text className={`text-sm font-semibold ${notaForm.status === s ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                      {STATUS_NOTA_LABEL[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {!!notaErro && (
              <View className="flex-row items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2.5 mb-4">
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text className="flex-1 text-xs text-red-600 dark:text-red-400">{notaErro}</Text>
              </View>
            )}

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setNotaModalVisible(false)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center"
                style={{ opacity: notaSalvando ? 0.6 : 1 }}
                disabled={notaSalvando}
                onPress={handleSaveNota}
              >
                <Text className="text-sm font-semibold text-white">
                  {notaSalvando ? 'Salvando...' : notaEditing ? 'Salvar' : 'Cadastrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Remover Nota Fiscal */}
      <Modal visible={!!notaDeleteTarget} transparent animationType="fade" onRequestClose={() => setNotaDeleteTarget(null)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 400 }}>
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 items-center justify-center mb-3">
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
              </View>
              <Text className="text-lg font-bold text-gray-800 dark:text-white">Remover Nota Fiscal</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
                Tem certeza que deseja remover a NF{' '}
                <Text className="font-bold text-gray-700 dark:text-gray-200">{notaDeleteTarget?.numero}</Text>?
                {' '}O lançamento financeiro vinculado também será removido.
              </Text>
            </View>
            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setNotaDeleteTarget(null)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl bg-red-500 items-center justify-center"
                onPress={handleDeleteNota}
              >
                <Text className="text-sm font-semibold text-white">Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
