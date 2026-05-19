import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
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

function LineChartPlaceholder() {
  const width = 400;
  const height = 160;
  const points1 = [200, 500, 450, 900, 700, 520, 510, 800, 700, 600, 250, 750];
  const points2 = [150, 450, 750, 500, 350, 400, 100, 430, 50, 400, 250, 750];

  const maxVal = 1000;
  const toX = (i: number) => (i / (points1.length - 1)) * width;
  const toY = (v: number) => height - (v / maxVal) * height;

  const buildPath = (pts: number[]) =>
    pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`).join(' ');

  const yLabels = [0, 250, 500, 750, 1000];
  const xLabels = Array.from({ length: points1.length }, (_, i) => i);

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {/* Y axis labels */}
        <View style={{ width: 36, height, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 4 }}>
          {[...yLabels].reverse().map(l => (
            <Text key={l} style={{ fontSize: 10, color: '#9ca3af' }}>{l}</Text>
          ))}
        </View>
        {/* SVG chart */}
        <View style={{ flex: 1 }}>
          <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Grid lines */}
            {yLabels.map(l => (
              <line
                key={l}
                x1={0} y1={toY(l)}
                x2={width} y2={toY(l)}
                stroke="#f0f0f0" strokeWidth={1}
              />
            ))}
            {/* Line 1 - red */}
            <path d={buildPath(points1)} fill="none" stroke="#e53e3e" strokeWidth={2} />
            {points1.map((v, i) => (
              <circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill="#e53e3e" />
            ))}
            {/* Line 2 - green */}
            <path d={buildPath(points2)} fill="none" stroke="#38a169" strokeWidth={2} />
            {points2.map((v, i) => (
              <circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill="#38a169" />
            ))}
          </svg>
        </View>
      </View>
      {/* X axis labels */}
      <View style={{ flexDirection: 'row', marginLeft: 36, marginTop: 4 }}>
        {xLabels.map(l => (
          <View key={l} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: '#9ca3af' }}>{l}</Text>
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
          {loadingEmpresas ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#3b5fe0" />
            </View>
          ) : empresas.length === 0 ? (
            <Text className="text-xs text-gray-400 dark:text-gray-500 text-center py-3 px-4">
              Nenhuma empresa no grupo
            </Text>
          ) : (
            empresas.map((e) => {
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

      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32 }}>

        {/* Saudação */}
        <Text className="text-xl font-semibold text-[#2B3674] dark:text-white mb-5">
          Olá, Lucas! Bem-vindo a{' '}
          <Text className="font-bold">{empresaAtual.nome}</Text>
        </Text>

        {/* Cards row */}
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>

          {/* Gráfico de Funcionários */}
          <View style={{
            flex: 1,
            backgroundColor: '#fff',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e2e5ea',
            padding: 16,
            minHeight: 220,
          }}>
            <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              Gráfico de Funcionarios
            </Text>
            <LineChartPlaceholder />
          </View>

          {/* Card Funcionários */}
          <View style={{
            width: 200,
            backgroundColor: '#fff',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e2e5ea',
            padding: 20,
            gap: 10,
          }}>
            {/* Ícone + Data */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: '#eef1fd',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="people-outline" size={22} color="#3b5fe0" />
              </View>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>
                {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>
            </View>

            {/* Número */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
              <Text style={{ fontSize: 48, fontWeight: '700', color: '#1e2d6e', lineHeight: 52 }}>
                210
              </Text>
              <Text style={{ fontSize: 15, color: '#6b7280', marginBottom: 6 }}>
                Funcionários
              </Text>
            </View>

            {/* Botão */}
            <TouchableOpacity style={{
              backgroundColor: '#3b5fe0',
              borderRadius: 8,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
            }} activeOpacity={0.85}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Acessar</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
