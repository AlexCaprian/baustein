import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import * as XLSX from 'xlsx';
import { ModuleHeader } from '@/components/layout/module-header';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { api, Batida, RegistroPonto, Usuario } from '@/services/api';
import { decodeId } from '@/services/idHash';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIAS_PT: Record<string, string> = {
  Sunday: 'Domingo', Monday: 'Segunda', Tuesday: 'Terça',
  Wednesday: 'Quarta', Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sábado',
};

function toISO(dataBR: string): string {
  const parts = dataBR.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dataBR;
}

function diaSemana(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const en = dt.toLocaleDateString('en-US', { weekday: 'long' });
  return DIAS_PT[en] ?? en;
}

function parseTime(t: string): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60;
}

// Retorna a carga horária esperada para o dia em formato HH:MM.
// Seg–Sex = hora_trabalha completo, Sáb = metade, Dom = '' (não aplicável).
function getCarga(diaSemana: string, horaTrabalha: number): string {
  if (diaSemana === 'Domingo') return '';
  const h = diaSemana === 'Sábado' ? horaTrabalha / 2 : horaTrabalha;
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function calcHoras(r: RegistroPonto, normaisOverride?: number | null) {
  const batidas = r.batidas ?? [];
  let trabalhadas = 0;
  let hasValid = false;

  for (const b of batidas) {
    const e = parseTime(b.entrada);
    const s = parseTime(b.saida);
    if (e != null && s != null && s > e) {
      trabalhadas += s - e;
      hasValid = true;
    }
  }

  if (!hasValid) return { trabalhadas: null, normais: null, extras: null, atraso: null, banco: null };

  const carga = normaisOverride ?? 8;
  const normais = Math.min(trabalhadas, carga);
  const extras = Math.max(trabalhadas - carga, 0);
  const primeiraEntrada = parseTime(batidas[0]?.entrada);
  const atraso = primeiraEntrada != null ? Math.max(primeiraEntrada - 8, 0) : 0;
  const banco = trabalhadas - carga;

  return { trabalhadas, normais, extras, atraso, banco };
}

function fmtHoras(h: number | null): string {
  if (h == null) return '';
  const sign = h < 0 ? '-' : '';
  const abs = Math.abs(h);
  const hh = Math.floor(abs);
  const mm = Math.round((abs - hh) * 60);
  return `${sign}${hh}h${mm > 0 ? mm + 'm' : ''}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function defaultDateFrom(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function defaultDateTo(): string {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return last.toISOString().split('T')[0];
}

function generateDaysForRange(from: string, to: string): RegistroPonto[] {
  const days: RegistroPonto[] = [];
  const end = new Date(to);
  const cur = new Date(from);
  while (cur <= end) {
    const iso = cur.toISOString().split('T')[0];
    days.push({ id: 0, grupo_id: 0, empresa_id: 0, usuario_id: 0, data: iso, dia_semana: diaSemana(iso), batidas: [], observacao: '' });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function labelPeriodo(from: string, to: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  return `${fmt(from)} a ${fmt(to)}`;
}

// ─── Time input ───────────────────────────────────────────────────────────────

function TimeInput({ value, onChange, isDark }: { value: string; onChange: (v: string) => void; isDark: boolean }) {
  const [focused, setFocused] = useState(false);

  function handleChange(txt: string) {
    const digits = txt.replace(/\D/g, '').slice(0, 4);
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + ':' + digits.slice(2);
    onChange(formatted);
  }

  return (
    <TextInput
      value={value}
      onChangeText={handleChange}
      placeholder="--:--"
      placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
      style={{
        fontSize: 14,
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
        color: isDark ? '#e5e7eb' : '#1f2937',
        backgroundColor: focused ? (isDark ? '#374151' : '#eff6ff') : 'transparent',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 2,
        width: 50,
        textAlign: 'center',
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      maxLength={5}
      keyboardType="numeric"
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PontoScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const params = useLocalSearchParams<{ empresaId: string; empresaName: string; grupoId: string }>();
  const empresaId = decodeId(params.empresaId);
  const empresaName = params.empresaName ?? '';
  const grupoId = decodeId(params.grupoId);

  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioSel, setUsuarioSel] = useState<Usuario | null>(null);
  const [userDropdown, setUserDropdown] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const [registros, setRegistros] = useState<RegistroPonto[]>([]);
  const [normaisOverrides, setNormaisOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [editMsg, setEditMsg] = useState('');

  // Modal de edição de batidas
  const [batidasModalIdx, setBatidasModalIdx] = useState<number | null>(null);
  const [modalBatidas, setModalBatidas] = useState<Batida[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const horaTrabalha = usuarioSel?.hora_trabalha ?? 8;

  // load users
  useEffect(() => {
    if (!empresaId) return;
    api.usuarios.list({ empresaId, limit: 100 }).then(r => {
      setUsuarios(r.usuarios);
      if (r.usuarios.length > 0 && !usuarioSel) setUsuarioSel(r.usuarios[0]);
    }).catch(() => {});
  }, [empresaId]);

  // load registros
  const loadRegistros = useCallback(async (uid: number, from: string, to: string) => {
    setLoading(true);
    setNormaisOverrides({});
    try {
      const res = await api.ponto.list(uid, from, to);
      const fromServer = res.registros ?? [];
      const days = generateDaysForRange(from, to);
      const byData: Record<string, RegistroPonto> = {};
      for (const r of fromServer) byData[r.data] = r;
      setRegistros(days.map(d => byData[d.data] ?? d));
    } catch {
      setRegistros(generateDaysForRange(from, to));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (usuarioSel) loadRegistros(usuarioSel.id, dateFrom, dateTo);
  }, [usuarioSel, dateFrom, dateTo, loadRegistros]);

  // ── Local edits ────────────────────────────────────────────────────────────

  function updateObs(idx: number, value: string) {
    setRegistros(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], observacao: value };
      return copy;
    });
  }

  // ── Modal de batidas ───────────────────────────────────────────────────────

  function openBatidasModal(rowIdx: number) {
    setBatidasModalIdx(rowIdx);
    setModalBatidas([...(registros[rowIdx].batidas ?? [])]);
  }

  function closeBatidasModal() {
    setBatidasModalIdx(null);
    setModalBatidas([]);
  }

  function confirmBatidasModal() {
    if (batidasModalIdx === null) return;
    setRegistros(prev => {
      const copy = [...prev];
      copy[batidasModalIdx] = { ...copy[batidasModalIdx], batidas: modalBatidas };
      return copy;
    });
    closeBatidasModal();
  }

  function modalUpdateBatida(bi: number, field: keyof Batida, value: string) {
    setModalBatidas(prev => prev.map((b, i) => i === bi ? { ...b, [field]: value } : b));
  }

  function modalAddBatida() {
    setModalBatidas(prev => [...prev, { entrada: '', saida: '' }]);
  }

  function modalRemoveBatida(bi: number) {
    setModalBatidas(prev => prev.filter((_, i) => i !== bi));
  }

  // ── Save all ───────────────────────────────────────────────────────────────

  async function saveAll() {
    if (!usuarioSel) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const toSave = registros.map(r => ({
        data: r.data,
        dia_semana: r.dia_semana,
        batidas: r.batidas ?? [],
        observacao: r.observacao,
      }));
      await api.ponto.bulkUpsert(usuarioSel.id, toSave);
      setSaveMsg('Salvo com sucesso!');
      await loadRegistros(usuarioSel.id, dateFrom, dateTo);
    } catch (e: any) {
      setSaveMsg('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  }

  // ── Import XLSX / CSV ──────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Find header row (Data, Dia, Entrada...)
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row && String(row[0]).toLowerCase().includes('data') && String(row[1]).toLowerCase().includes('dia')) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) {
          setEditMsg('Formato inválido: linha de cabeçalho não encontrada');
          setTimeout(() => setEditMsg(''), 3000);
          return;
        }

        // Descobre quantos pares Entrada/Saída existem no cabeçalho
        const headerRow = rows[headerIdx] as any[];
        let pairCount = 0;
        for (let ci = 2; ci + 1 < headerRow.length; ci += 2) {
          const h = String(headerRow[ci] ?? '').toLowerCase();
          if (h.includes('entrada')) pairCount++;
          else break;
        }
        if (pairCount === 0) pairCount = 1; // fallback
        // Obs fica após os pares + 4 colunas de totais (Trabalhadas, Normais, Extras, Atraso)
        const obsColIdx = 2 + pairCount * 2 + 4;

        const parsed: RegistroPonto[] = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0]) continue;
          const rawData = String(row[0]);
          if (!rawData.includes('/') && !rawData.includes('-')) continue;
          const iso = rawData.includes('/') ? toISO(rawData) : rawData;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;

          const batidas: Batida[] = [];
          for (let p = 0; p < pairCount; p++) {
            const entrada = String(row[2 + p * 2] ?? '').trim();
            const saida = String(row[2 + p * 2 + 1] ?? '').trim();
            if (entrada || saida) batidas.push({ entrada, saida });
          }

          parsed.push({
            id: 0,
            grupo_id: 0,
            empresa_id: 0,
            usuario_id: usuarioSel?.id ?? 0,
            data: iso,
            dia_semana: String(row[1] ?? diaSemana(iso)),
            batidas,
            observacao: String(row[obsColIdx] ?? ''),
          });
        }

        // Merge into current range days
        const days = generateDaysForRange(dateFrom, dateTo);
        const byData: Record<string, RegistroPonto> = {};
        for (const r of parsed) byData[r.data] = r;
        setRegistros(days.map(d => byData[d.data] ?? d));
        setEditMsg(`${parsed.length} dias importados. Clique em "Salvar" para confirmar.`);
        setTimeout(() => setEditMsg(''), 5000);
      } catch {
        setEditMsg('Erro ao ler arquivo. Verifique o formato.');
        setTimeout(() => setEditMsg(''), 4000);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  // ── Export XLSX ────────────────────────────────────────────────────────────

  function exportXLSX() {
    const nomeFuncionario = usuarioSel?.nome ?? 'Funcionário';
    const titulo = `CONTROLE DE PONTO – ${labelPeriodo(dateFrom, dateTo)}`;
    const info = `Funcionário: ${nomeFuncionario}`;

    const maxPairs = Math.max(...registros.map(r => (r.batidas ?? []).length), 1);
    const header = ['Data', 'Dia'];
    for (let p = 0; p < maxPairs; p++) {
      header.push('Entrada', 'Saída');
    }
    header.push('H. Trabalhadas', 'H. Normais', 'H. Extras', 'Atraso', 'Obs.', 'Banco de H.');

    const dataRows = registros.map(r => {
      const cargaStr = getCarga(r.dia_semana, horaTrabalha);
      const normaisStr = normaisOverrides[r.data] !== undefined ? normaisOverrides[r.data] : cargaStr;
      const c = calcHoras(r, parseTime(normaisStr));
      const [y, m2, d] = r.data.split('-');
      const row: string[] = [`${d}/${m2}/${y}`, r.dia_semana];
      for (let p = 0; p < maxPairs; p++) {
        const b = (r.batidas ?? [])[p];
        row.push(b?.entrada ?? '', b?.saida ?? '');
      }
      row.push(
        c.trabalhadas != null ? fmtHoras(c.trabalhadas) : '',
        c.normais != null ? fmtHoras(c.normais) : '',
        c.extras != null ? fmtHoras(c.extras) : '',
        c.atraso != null ? fmtHoras(c.atraso) : '',
        r.observacao,
        c.banco != null ? fmtHoras(c.banco) : '',
      );
      return row;
    });

    const wsData = [
      [titulo],
      [info],
      [],
      header,
      ...dataRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Controle de Ponto');
    XLSX.writeFile(wb, `ponto_${nomeFuncionario.replace(/\s+/g, '_')}_${dateFrom}_${dateTo}.xlsx`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const totais = registros.reduce((acc, r) => {
    const cargaStr = getCarga(r.dia_semana, horaTrabalha);
    const normaisStr = normaisOverrides[r.data] !== undefined ? normaisOverrides[r.data] : cargaStr;
    const normaisVal = parseTime(normaisStr);
    const c = calcHoras(r, normaisVal);
    return {
      trabalhadas: acc.trabalhadas + (c.trabalhadas ?? 0),
      extras: acc.extras + (c.extras ?? 0),
      atraso: acc.atraso + (c.atraso ?? 0),
      banco: acc.banco + (c.banco ?? 0),
    };
  }, { trabalhadas: 0, extras: 0, atraso: 0, banco: 0 });

  const [tableWidth, setTableWidth] = useState(0);
  const MIN_COL_WIDTHS = [80, 72, 190, 72, 72, 72, 72, 150, 80];
  const MIN_TOTAL = MIN_COL_WIDTHS.reduce((a, b) => a + b, 0);
  const effectiveColWidths = tableWidth > MIN_TOTAL
    ? MIN_COL_WIDTHS.map(w => w + (w / MIN_TOTAL) * (tableWidth - MIN_TOTAL))
    : MIN_COL_WIDTHS;
  const colHeaders = ['Data', 'Dia', 'Batidas (entrada → saída)', 'Trabalhadas', 'Normais', 'Extras', 'Atraso', 'Obs.', 'Banco H.'];

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#030712' : '#f8fafc' }}>
      <LoadingOverlay visible={saving} />

      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}

      <ModuleHeader title="Controle de Ponto" empresaId={empresaId} empresaName={empresaName} grupoId={grupoId} />

      <ScrollView contentContainerStyle={{ padding: isMobile ? 12 : 24, paddingTop: isMobile ? 16 : 28 }}>

        {/* Seletores */}
        <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 12, marginBottom: 20, zIndex: 300 }}>

          {/* Funcionário */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 4 }}>FUNCIONÁRIO</Text>
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: isDark ? '#1f2937' : '#fff',
                borderWidth: 1, borderColor: isDark ? '#374151' : '#e2e8f0',
                borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
              }}
              onPress={() => { setUserDropdown(true); setUserSearch(''); }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14, color: isDark ? '#e5e7eb' : '#1f2937' }} numberOfLines={1}>
                {usuarioSel?.nome ?? 'Selecionar funcionário'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
          </View>

          {/* Período: De */}
          <View style={{ width: isMobile ? '100%' : 160 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 4 }}>DE</Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: isDark ? '#1f2937' : '#fff',
              borderWidth: 1, borderColor: isDark ? '#374151' : '#e2e8f0',
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9,
            }}>
              <Ionicons name="calendar-outline" size={14} color={isDark ? '#6b7280' : '#9ca3af'} />
              {Platform.OS === 'web' && (
                <input
                  type="date"
                  value={dateFrom}
                  min="2000-01-01"
                  max="2100-12-31"
                  onChange={e => {
                    const val = e.target.value;
                    setDateFrom(val);
                    if (dateTo < val) setDateTo(val);
                    else if (dateTo > addDays(val, 30)) setDateTo(addDays(val, 30));
                  }}
                  style={{
                    flex: 1, fontSize: 13, border: 'none', outline: 'none', background: 'transparent',
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    colorScheme: isDark ? 'dark' : 'light',
                    cursor: 'pointer', fontFamily: 'inherit',
                  } as any}
                />
              )}
            </View>
          </View>

          {/* Período: Até */}
          <View style={{ width: isMobile ? '100%' : 160 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280', marginBottom: 4 }}>ATÉ</Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: isDark ? '#1f2937' : '#fff',
              borderWidth: 1, borderColor: isDark ? '#374151' : '#e2e8f0',
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9,
            }}>
              <Ionicons name="calendar-outline" size={14} color={isDark ? '#6b7280' : '#9ca3af'} />
              {Platform.OS === 'web' && (
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  max={addDays(dateFrom, 30)}
                  onChange={e => setDateTo(e.target.value)}
                  style={{
                    flex: 1, fontSize: 13, border: 'none', outline: 'none', background: 'transparent',
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    colorScheme: isDark ? 'dark' : 'light',
                    cursor: 'pointer', fontFamily: 'inherit',
                  } as any}
                />
              )}
            </View>
          </View>
        </View>

        {/* Botões de ação */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: isDark ? '#1f2937' : '#fff',
                borderWidth: 1, borderColor: isDark ? '#374151' : '#e2e8f0',
                borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9,
              }}
              onPress={() => fileInputRef.current?.click()}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload-outline" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#e5e7eb' : '#374151' }}>Importar XLSX / CSV</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: isDark ? '#1f2937' : '#fff',
              borderWidth: 1, borderColor: isDark ? '#374151' : '#e2e8f0',
              borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9,
            }}
            onPress={exportXLSX}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#e5e7eb' : '#374151' }}>Exportar XLSX</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: '#3b5fe0',
              borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9,
            }}
            onPress={saveAll}
            activeOpacity={0.85}
            disabled={saving}
          >
            <Ionicons name="save-outline" size={16} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Salvar</Text>
          </TouchableOpacity>
        </View>

        {/* Mensagens */}
        {!!(saveMsg || editMsg) && (
          <View style={{
            backgroundColor: (saveMsg.startsWith('Erro') || editMsg.startsWith('Erro') || editMsg.startsWith('Formato'))
              ? (isDark ? '#7f1d1d' : '#fef2f2')
              : (isDark ? '#052e16' : '#f0fdf4'),
            borderRadius: 8, padding: 10, marginBottom: 12,
          }}>
            <Text style={{
              fontSize: 13,
              color: (saveMsg.startsWith('Erro') || editMsg.startsWith('Erro') || editMsg.startsWith('Formato'))
                ? (isDark ? '#fca5a5' : '#dc2626')
                : (isDark ? '#86efac' : '#16a34a'),
            }}>
              {saveMsg || editMsg}
            </Text>
          </View>
        )}

        {/* Tabela */}
        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator color="#3b5fe0" />
          </View>
        ) : (
          <View
            style={{
              backgroundColor: isDark ? '#111827' : '#fff',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? '#1f2937' : '#e2e8f0',
              overflow: 'hidden',
            }}
            onLayout={e => setTableWidth(e.nativeEvent.layout.width)}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={tableWidth <= MIN_TOTAL}>
              <View style={{ width: Math.max(tableWidth, MIN_TOTAL) }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1f2937' : '#f8fafc', borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#e2e8f0' }}>
                  {colHeaders.map((h, i) => (
                    <View key={i} style={{ width: effectiveColWidths[i], paddingHorizontal: 8, paddingVertical: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#9ca3af' : '#64748b', textTransform: 'uppercase' }} numberOfLines={1}>{h}</Text>
                    </View>
                  ))}
                </View>

                {/* Rows */}
                {registros.map((r, idx) => {
                  const cargaStr = getCarga(r.dia_semana, horaTrabalha);
                  const normaisStr = normaisOverrides[r.data] !== undefined ? normaisOverrides[r.data] : cargaStr;
                  const normaisVal = parseTime(normaisStr);
                  const c = calcHoras(r, normaisVal);
                  const isWeekend = r.dia_semana === 'Sábado' || r.dia_semana === 'Domingo';
                  const bgColor = isWeekend
                    ? (isDark ? '#0f172a' : '#f8fafc')
                    : idx % 2 === 0
                      ? 'transparent'
                      : (isDark ? '#0a0e1a' : '#fafafa');

                  const [y, m2, d] = r.data.split('-');
                  const dataBR = `${d}/${m2}/${y}`;

                  return (
                    <View key={r.data} style={{ flexDirection: 'row', backgroundColor: bgColor, borderBottomWidth: 1, borderBottomColor: isDark ? '#1f2937' : '#f1f5f9', alignItems: 'center' }}>
                      {/* Data */}
                      <View style={{ width: effectiveColWidths[0], paddingHorizontal: 8, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 14, color: isDark ? '#e5e7eb' : '#374151', fontWeight: '500' }}>{dataBR}</Text>
                      </View>
                      {/* Dia */}
                      <View style={{ width: effectiveColWidths[1], paddingHorizontal: 8, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 14, color: isWeekend ? (isDark ? '#6b7280' : '#94a3b8') : (isDark ? '#e5e7eb' : '#374151') }} numberOfLines={1}>{r.dia_semana}</Text>
                      </View>
                      {/* Batidas — pills clicáveis */}
                      <TouchableOpacity
                        style={{ width: effectiveColWidths[2], paddingHorizontal: 6, paddingVertical: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', minHeight: 36 }}
                        onPress={() => !isWeekend && openBatidasModal(idx)}
                        activeOpacity={isWeekend ? 1 : 0.7}
                      >
                        {!isWeekend && (r.batidas ?? []).length === 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="add-circle-outline" size={14} color={isDark ? '#4b5563' : '#d1d5db'} />
                            <Text style={{ fontSize: 13, color: isDark ? '#4b5563' : '#d1d5db' }}>Adicionar</Text>
                          </View>
                        )}
                        {!isWeekend && (r.batidas ?? []).map((b, bi) => (
                          <View key={bi} style={{
                            flexDirection: 'row', alignItems: 'center',
                            backgroundColor: isDark ? '#172554' : '#eff6ff',
                            borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
                          }}>
                            <Text style={{ fontSize: 13, color: isDark ? '#93c5fd' : '#3b5fe0', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>
                              {b.entrada || '--:--'} → {b.saida || '--:--'}
                            </Text>
                          </View>
                        ))}
                        {!isWeekend && (r.batidas ?? []).length > 0 && (
                          <Ionicons name="create-outline" size={11} color={isDark ? '#374151' : '#cbd5e1'} />
                        )}
                      </TouchableOpacity>
                      {/* H. Trabalhadas */}
                      <View style={{ width: effectiveColWidths[3], paddingHorizontal: 8, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 14, color: isDark ? '#a5b4fc' : '#4f46e5', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>{fmtHoras(c.trabalhadas)}</Text>
                      </View>
                      {/* H. Normais — editável (pré-preenchido de hora_trabalha; Domingo fica vazio) */}
                      <View style={{ width: effectiveColWidths[4], paddingHorizontal: 4, paddingVertical: 5, justifyContent: 'center' }}>
                        {r.dia_semana !== 'Domingo' && (
                          <TimeInput
                            value={normaisStr}
                            onChange={v => setNormaisOverrides(prev => ({ ...prev, [r.data]: v }))}
                            isDark={isDark}
                          />
                        )}
                      </View>
                      {/* H. Extras */}
                      <View style={{ width: effectiveColWidths[5], paddingHorizontal: 8, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 14, color: c.extras && c.extras > 0 ? (isDark ? '#86efac' : '#16a34a') : (isDark ? '#9ca3af' : '#94a3b8'), fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>{fmtHoras(c.extras)}</Text>
                      </View>
                      {/* Atraso */}
                      <View style={{ width: effectiveColWidths[6], paddingHorizontal: 8, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 14, color: c.atraso && c.atraso > 0 ? (isDark ? '#fca5a5' : '#dc2626') : (isDark ? '#9ca3af' : '#94a3b8'), fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>{fmtHoras(c.atraso)}</Text>
                      </View>
                      {/* Obs */}
                      <View style={{ width: effectiveColWidths[7], paddingHorizontal: 4, paddingVertical: 5 }}>
                        <TextInput
                          value={r.observacao}
                          onChangeText={v => updateObs(idx, v)}
                          placeholder="—"
                          placeholderTextColor={isDark ? '#4b5563' : '#cbd5e1'}
                          style={{
                            fontSize: 13,
                            color: isDark ? '#d1d5db' : '#374151',
                            backgroundColor: 'transparent',
                            paddingHorizontal: 4,
                            paddingVertical: 2,
                          }}
                          numberOfLines={1}
                        />
                      </View>
                      {/* Banco H. */}
                      <View style={{ width: effectiveColWidths[8], paddingHorizontal: 8, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 14, color: c.banco != null && c.banco >= 0 ? (isDark ? '#86efac' : '#16a34a') : (isDark ? '#fca5a5' : '#dc2626'), fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>{fmtHoras(c.banco)}</Text>
                      </View>
                    </View>
                  );
                })}

                {/* Totais */}
                <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1f2937' : '#f1f5f9', borderTopWidth: 2, borderTopColor: isDark ? '#374151' : '#cbd5e1', alignItems: 'center' }}>
                  <View style={{ width: effectiveColWidths[0] + effectiveColWidths[1] + effectiveColWidths[2], paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#f9fafb' : '#1e293b' }}>TOTAIS DO PERÍODO</Text>
                  </View>
                  <View style={{ width: effectiveColWidths[3], paddingHorizontal: 8, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#a5b4fc' : '#4f46e5' }}>{fmtHoras(totais.trabalhadas)}</Text>
                  </View>
                  <View style={{ width: effectiveColWidths[4], paddingHorizontal: 8 }} />
                  <View style={{ width: effectiveColWidths[5], paddingHorizontal: 8, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#86efac' : '#16a34a' }}>{fmtHoras(totais.extras)}</Text>
                  </View>
                  <View style={{ width: effectiveColWidths[6], paddingHorizontal: 8, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#fca5a5' : '#dc2626' }}>{fmtHoras(totais.atraso)}</Text>
                  </View>
                  <View style={{ width: effectiveColWidths[7], paddingHorizontal: 8 }} />
                  <View style={{ width: effectiveColWidths[8], paddingHorizontal: 8, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: totais.banco >= 0 ? (isDark ? '#86efac' : '#16a34a') : (isDark ? '#fca5a5' : '#dc2626') }}>{fmtHoras(totais.banco)}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal de edição de batidas */}
      {(() => {
        const modalRow = batidasModalIdx !== null ? registros[batidasModalIdx] : null;
        if (!modalRow) return null;
        const [my, mm, md] = modalRow.data.split('-');
        const modalDateLabel = `${md}/${mm}/${my} · ${modalRow.dia_semana}`;
        return (
          <Modal visible transparent animationType="fade" onRequestClose={closeBatidasModal}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
              onPress={closeBatidasModal}
              activeOpacity={1}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => {}}>
                <View style={{
                  width: 340, backgroundColor: isDark ? '#1f2937' : '#fff',
                  borderRadius: 16, overflow: 'hidden',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 16,
                }}>
                  {/* Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#f1f5f9' }}>
                    <View>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: isDark ? '#f9fafb' : '#1e2d6e' }}>Batidas</Text>
                      <Text style={{ fontSize: 14, color: isDark ? '#9ca3af' : '#6b7280', marginTop: 1 }}>{modalDateLabel}</Text>
                    </View>
                    <TouchableOpacity onPress={closeBatidasModal} activeOpacity={0.7} style={{ padding: 4 }}>
                      <Ionicons name="close" size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                    </TouchableOpacity>
                  </View>

                  {/* Lista de pares */}
                  <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                    {modalBatidas.length === 0 && (
                      <Text style={{ fontSize: 15, color: isDark ? '#6b7280' : '#9ca3af', textAlign: 'center', paddingVertical: 8 }}>
                        Nenhuma batida registrada
                      </Text>
                    )}
                    {modalBatidas.map((b, bi) => (
                      <View key={bi} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {/* Número do par */}
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: isDark ? '#374151' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#9ca3af' : '#6b7280' }}>{bi + 1}</Text>
                          </View>
                          {/* Entrada */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#6b7280' : '#9ca3af', marginBottom: 3 }}>ENTRADA</Text>
                            <View style={{ backgroundColor: isDark ? '#111827' : '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#374151' : '#e2e8f0' }}>
                              <TimeInput value={b.entrada} onChange={v => modalUpdateBatida(bi, 'entrada', v)} isDark={isDark} />
                            </View>
                          </View>
                          <Text style={{ fontSize: 18, color: isDark ? '#4b5563' : '#d1d5db', marginTop: 14 }}>→</Text>
                          {/* Saída */}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#6b7280' : '#9ca3af', marginBottom: 3 }}>SAÍDA</Text>
                            <View style={{ backgroundColor: isDark ? '#111827' : '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#374151' : '#e2e8f0' }}>
                              <TimeInput value={b.saida} onChange={v => modalUpdateBatida(bi, 'saida', v)} isDark={isDark} />
                            </View>
                          </View>
                          {/* Remover */}
                          <TouchableOpacity onPress={() => modalRemoveBatida(bi)} activeOpacity={0.7} style={{ marginTop: 14, padding: 4 }}>
                            <Ionicons name="trash-outline" size={16} color={isDark ? '#ef4444' : '#dc2626'} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    {/* Botão adicionar par */}
                    <TouchableOpacity
                      onPress={modalAddBatida}
                      activeOpacity={0.7}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? '#374151' : '#e2e8f0', borderRadius: 8, marginBottom: 4 }}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
                      <Text style={{ fontSize: 15, color: isDark ? '#6b7280' : '#9ca3af' }}>Adicionar par</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Footer */}
                  <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4 }}>
                    <TouchableOpacity
                      onPress={closeBatidasModal}
                      activeOpacity={0.7}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: isDark ? '#374151' : '#e2e8f0', alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280' }}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={confirmBatidasModal}
                      activeOpacity={0.85}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#3b5fe0', alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        );
      })()}

      {/* Modal de seleção de funcionário */}
      <Modal
        visible={userDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => { setUserDropdown(false); setUserSearch(''); }}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          activeOpacity={1}
          onPress={() => { setUserDropdown(false); setUserSearch(''); }}
        >
          <TouchableOpacity activeOpacity={1} style={{ width: '100%', maxWidth: 400 }}>
            <View style={{
              backgroundColor: isDark ? '#1f2937' : '#fff',
              borderRadius: 12, overflow: 'hidden',
              shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
            }}>
              {/* Header com busca */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 14, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: isDark ? '#374151' : '#f1f5f9',
              }}>
                <Ionicons name="search-outline" size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
                <TextInput
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Pesquisar funcionário..."
                  placeholderTextColor={isDark ? '#4b5563' : '#9ca3af'}
                  autoFocus
                  style={{
                    flex: 1, fontSize: 16,
                    color: isDark ? '#e5e7eb' : '#1f2937',
                    backgroundColor: 'transparent',
                    paddingVertical: 2,
                  }}
                />
                {!!userSearch && (
                  <TouchableOpacity onPress={() => setUserSearch('')} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Lista */}
              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                {usuarios
                  .filter(u => u.nome.toLowerCase().includes(userSearch.toLowerCase()))
                  .map(u => (
                    <TouchableOpacity
                      key={u.id}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingHorizontal: 16, paddingVertical: 12,
                        backgroundColor: usuarioSel?.id === u.id ? (isDark ? '#1e3a5f' : '#eff6ff') : 'transparent',
                        borderBottomWidth: 1, borderBottomColor: isDark ? '#1f2937' : '#f8fafc',
                      }}
                      onPress={() => { setUsuarioSel(u); setUserDropdown(false); setUserSearch(''); }}
                      activeOpacity={0.7}
                    >
                      <View style={{
                        width: 32, height: 32, borderRadius: 16,
                        backgroundColor: isDark ? '#374151' : '#e2e8f0',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#9ca3af' : '#6b7280' }}>
                          {u.nome.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 16, color: isDark ? '#e5e7eb' : '#1f2937' }}>{u.nome}</Text>
                      {usuarioSel?.id === u.id && (
                        <Ionicons name="checkmark" size={16} color={isDark ? '#60a5fa' : '#3b5fe0'} />
                      )}
                    </TouchableOpacity>
                  ))
                }
                {usuarios.filter(u => u.nome.toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, color: isDark ? '#6b7280' : '#9ca3af' }}>Nenhum resultado</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
