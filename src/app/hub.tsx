import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { getPerfil, getNome } from '../services/api';
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { AppHeader } from '../components/app-header';
import { api, Empresa } from '../services/api';
import { LoadingOverlay } from '../components/loading-overlay';

const Y_AXIS_W = 36;
const X_AXIS_H = 18;
const LEGEND_H = 24;

const HOURS_DATA = [
  { label: 'Jan', certas: 138, extras: 42, menos: 30 },
  { label: 'Fev', certas: 150, extras: 35, menos: 25 },
  { label: 'Mar', certas: 125, extras: 55, menos: 30 },
  { label: 'Abr', certas: 160, extras: 30, menos: 20 },
  { label: 'Mai', certas: 143, extras: 44, menos: 23 },
  { label: 'Jun', certas: 148, extras: 38, menos: 24 },
  { label: 'Jul', certas: 152, extras: 36, menos: 22 },
  { label: 'Ago', certas: 145, extras: 40, menos: 25 },
  { label: 'Set', certas: 158, extras: 32, menos: 20 },
  { label: 'Out', certas: 140, extras: 48, menos: 22 },
  { label: 'Nov', certas: 155, extras: 33, menos: 22 },
  { label: 'Dez', certas: 162, extras: 28, menos: 20 },
];

const SERIES = [
  { key: 'certas' as const, label: 'Horas certas', color: '#3b5fe0' },
  { key: 'extras' as const, label: 'Horas extras', color: '#f59e0b' },
  { key: 'menos'  as const, label: 'Horas a menos', color: '#ef4444' },
];

const TOOLTIP_W = 148;
const TOOLTIP_H = 58;

type TooltipState = {
  x: number; y: number;
  value: number; series: string; month: string; color: string;
} | null;

function HoursBarChart() {
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  const maxVal = 210;
  const yLabels = [0, 70, 140, 210];

  const svgW = Math.max(0, dims.w - Y_AXIS_W);
  const svgH = Math.max(0, dims.h - X_AXIS_H - LEGEND_H);

  const n = HOURS_DATA.length;
  const groupW = svgW / n;
  const pad = groupW * 0.1;
  const barW = (groupW - pad * 4) / 3;

  const toH = (v: number) => (v / maxVal) * svgH;
  const toY = (v: number) => svgH - toH(v);
  const xBar = (i: number, s: number) => i * groupW + pad + s * (barW + pad);

  const handleBarClick = (e: any, d: typeof HOURS_DATA[0], s: typeof SERIES[0], i: number, si: number) => {
    e.stopPropagation();
    const barCenterX = xBar(i, si) + barW / 2;
    const barTopY = toY(d[s.key]);
    const tx = Math.min(Math.max(barCenterX - TOOLTIP_W / 2, 0), svgW - TOOLTIP_W);
    const ty = Math.max(barTopY - TOOLTIP_H - 10, 0);
    const isSame = tooltip?.series === s.label && tooltip?.month === d.label;
    setTooltip(isSame ? null : { x: tx, y: ty, value: d[s.key], series: s.label, month: d.label, color: s.color });
  };

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setDims({ w: width, h: height });
      }}
    >
      {/* Legenda */}
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 8, marginLeft: Y_AXIS_W, height: LEGEND_H, alignItems: 'center' }}>
        {SERIES.map(s => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color }} />
            <Text style={{ fontSize: 11, color: '#6b7280' }}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', height: svgH }}>
        {/* Y axis */}
        <View style={{ width: Y_AXIS_W, height: svgH, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 }}>
          {[...yLabels].reverse().map(l => (
            <Text key={l} style={{ fontSize: 10, color: '#9ca3af' }}>{l}</Text>
          ))}
        </View>

        {/* SVG + tooltip container */}
        <View style={{ flex: 1, position: 'relative' }}>
          {svgW > 0 && svgH > 0 && (
            <svg width={svgW} height={svgH} onClick={() => setTooltip(null)} style={{ display: 'block' }}>
              {yLabels.map(l => (
                <line key={l} x1={0} y1={toY(l)} x2={svgW} y2={toY(l)} stroke="#f3f4f6" strokeWidth={1} />
              ))}
              {HOURS_DATA.map((d, i) =>
                SERIES.map((s, si) => (
                  <rect
                    key={`${i}-${si}`}
                    x={xBar(i, si)}
                    y={toY(d[s.key])}
                    width={barW}
                    height={toH(d[s.key])}
                    fill={s.color}
                    rx={3}
                    opacity={tooltip?.series === s.label && tooltip?.month === d.label ? 1 : 0.88}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => handleBarClick(e, d, s, i, si)}
                  />
                ))
              )}
            </svg>
          )}

          {/* Tooltip */}
          {tooltip && (
            <View
              style={{
                position: 'absolute',
                left: tooltip.x,
                top: tooltip.y,
                width: TOOLTIP_W,
                backgroundColor: '#1e293b',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.22,
                shadowRadius: 8,
                gap: 4,
              }}
              pointerEvents="none"
            >
              <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: '500' }}>
                {tooltip.month} · {tooltip.series}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: tooltip.color }} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#f1f5f9' }}>
                  {tooltip.value}
                  <Text style={{ fontSize: 11, fontWeight: '400', color: '#94a3b8' }}> funcionários</Text>
                </Text>
              </View>
              {/* Seta */}
              <View style={{
                position: 'absolute',
                bottom: -6, left: TOOLTIP_W / 2 - 6,
                width: 0, height: 0,
                borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6,
                borderLeftColor: 'transparent', borderRightColor: 'transparent',
                borderTopColor: '#1e293b',
              }} />
            </View>
          )}
        </View>
      </View>

      {/* X axis */}
      <View style={{ flexDirection: 'row', marginLeft: Y_AXIS_W, marginTop: 4, height: X_AXIS_H - 4 }}>
        {HOURS_DATA.map(d => (
          <View key={d.label} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#9ca3af' }}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
export default function HubScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const params = useLocalSearchParams<{ empresaId: string; empresaName: string; grupoId: string }>();

  const [empresaAtual, setEmpresaAtual] = useState<{ id: number; nome: string }>({
    id: Number(params.empresaId),
    nome: params.empresaName ?? 'Empresa',
  });
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const loadEmpresas = useCallback(async () => {
    const grupoId = Number(params.grupoId);
    if (!grupoId) return;
    setLoadingEmpresas(true);
    try {
      const res = await api.empresas.list(grupoId);
      setEmpresas(res.empresas ?? []);
    } catch {
      // silencioso — dropdown só não mostra outras empresas
    } finally {
      setLoadingEmpresas(false);
    }
  }, [params.grupoId]);

  useEffect(() => { loadEmpresas(); }, [loadEmpresas]);

  const trocarEmpresa = (e: Empresa) => {
    setEmpresaAtual({ id: e.id, nome: e.nome_fantasia });
    setDropdownOpen(false);
  };

  const EmpresaSelector = (
    <View style={{ zIndex: 200, overflow: 'visible' }}>
      <TouchableOpacity
        className="flex-row items-center gap-1.5 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5"
        onPress={() => setDropdownOpen(p => !p)}
        activeOpacity={0.7}
      >
        <Ionicons name="business-outline" size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
        <Text
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
          style={{ maxWidth: 130 }}
          numberOfLines={1}
        >
          {empresaAtual.nome}
        </Text>
        <Ionicons
          name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={isDark ? '#9ca3af' : '#6b7280'}
        />
      </TouchableOpacity>

      {dropdownOpen && (
        <View
          className="absolute right-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 py-1"
          style={{ top: 42, minWidth: 200, zIndex: 999, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8 }}
        >
          {empresas.length === 0 && !loadingEmpresas ? (
            <Text className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 px-4">
              Nenhuma empresa no grupo
            </Text>
          ) : (
            !loadingEmpresas && empresas.map((e) => {
              const ativa = e.id === empresaAtual.id;
              return (
                <TouchableOpacity
                  key={e.id}
                  className={`flex-row items-center gap-2.5 px-4 py-3 ${ativa ? 'bg-indigo-50 dark:bg-indigo-950/50' : ''}`}
                  onPress={() => trocarEmpresa(e)}
                  activeOpacity={0.7}
                >
                  <View className={`w-6 h-6 rounded-md items-center justify-center ${ativa ? 'bg-[#3b5fe0]' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <Text className={`text-xs font-bold ${ativa ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {e.nome_fantasia.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    className={`flex-1 text-sm font-medium ${ativa ? 'text-[#3b5fe0] dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'}`}
                    numberOfLines={1}
                  >
                    {e.nome_fantasia}
                  </Text>
                  {ativa && <Ionicons name="checkmark" size={15} color="#3b5fe0" />}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-gray-950">
      {/* Fechar dropdown ao clicar fora */}
      {dropdownOpen && (
        <TouchableOpacity
          className="absolute inset-0"
          style={{ zIndex: 100 }}
          onPress={() => setDropdownOpen(false)}
          activeOpacity={1}
        />
      )}

      <AppHeader right={EmpresaSelector} />

      <LoadingOverlay visible={loadingEmpresas} />

      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1200 }}>

          {/* Voltar para seleção de empresa (só dev) */}
          {getPerfil() === 'dev' && (
            <TouchableOpacity
              className="flex-row items-center gap-1.5 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 mb-5 self-start"
              onPress={() => router.replace('/select-empresa' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back-outline" size={15} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">Selecionar Empresa</Text>
            </TouchableOpacity>
          )}

          {/* Saudação */}
          <Text className="text-xl font-semibold text-[#2B3674] dark:text-white mb-5">
            Olá, {getNome().split(' ')[0] || 'usuário'}! Bem-vindo a{' '}
            <Text className="font-bold">{empresaAtual.nome}</Text>
          </Text>

          {/* Cards row */}
          <View style={{ flexDirection: 'row', gap: 16, height: 300 }}>

            {/* Gráfico de Funcionários */}
            <View style={{
              flex: 1,
              backgroundColor: '#fff',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e2e5ea',
              padding: 24,
            }}>
              <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
                Horas dos Funcionários por Mês
              </Text>
              <View style={{ flex: 1 }}>
                <HoursBarChart />
              </View>
            </View>

            {/* Card Funcionários */}
            <View style={{
              width: 300,
              backgroundColor: '#fff',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e2e5ea',
              padding: 24,
              gap: 16,
              justifyContent: 'space-between',
            }}>
              {/* Ícone + Data */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: '#eef1fd',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="people-outline" size={24} color="#3b5fe0" />
                </View>
                <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
              </View>

              {/* Número */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <Text style={{ fontSize: 62, fontWeight: '700', color: '#1e2d6e', lineHeight: 56 }}>
                  210
                </Text>
                <Text style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>
                  Funcionários
                </Text>
              </View>

              {/* Botão */}
              <TouchableOpacity
                style={{ backgroundColor: '#3b5fe0', borderRadius: 8, height: 44, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/funcionarios', params: { empresaId: empresaAtual.id, empresaName: empresaAtual.nome, grupoId: params.grupoId } } as any)}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Acessar</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </ScrollView>
    </View>
  );
}
