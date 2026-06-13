import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { AppHeader } from '@/components/layout/app-header';
import { api, Empresa, getNome, getPerfil, getEmpresaId, MODULOS } from '@/services/api';
import { decodeId, encodeId } from '@/services/idHash';

export default function HubScreen() {

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const params = useLocalSearchParams<{ empresaId: string; empresaName: string; grupoId: string }>();

  const isDev = getPerfil() === 'dev';

  const [empresaAtual, setEmpresaAtual] = useState<{ id: number; nome: string }>({
    id: decodeId(params.empresaId) || 0,
    nome: params.empresaName ?? 'Carregando...',
  });
  const [grupoId, setGrupoId] = useState<number>(decodeId(params.grupoId) || 0);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [totalFuncionarios, setTotalFuncionarios] = useState<number | null>(null);
  const [modulosHabilitados, setModulosHabilitados] = useState<string[]>([...MODULOS]);

  useEffect(() => {
    if (isDev) return;
    const id = getEmpresaId();
    if (!id) return;
    api.empresas.get(id).then((e) => {
      setEmpresaAtual({ id: e.id, nome: e.nome_fantasia });
      if (e.grupo_id) setGrupoId(e.grupo_id);
    }).catch(() => {});
  }, [isDev]);

  const loadEmpresas = useCallback(async (gId: number) => {
    if (!gId) return;
    setLoadingEmpresas(true);
    try {
      const res = await api.empresas.list(gId);
      setEmpresas(res.empresas ?? []);
    } catch {
      // silencioso — dropdown só não mostra outras empresas
    } finally {
      setLoadingEmpresas(false);
    }
  }, []);

  useEffect(() => { if (grupoId) loadEmpresas(grupoId); }, [grupoId, loadEmpresas]);

  useEffect(() => {
    if (!empresaAtual.id) return;
    api.usuarios.list({ empresaId: empresaAtual.id, limit: 1 })
      .then((res) => setTotalFuncionarios(res.total))
      .catch(() => {});
  }, [empresaAtual.id]);

  useEffect(() => {
    if (!empresaAtual.id) return;
    api.modulos.get(empresaAtual.id)
      .then((res) => setModulosHabilitados(res.modulos))
      .catch(() => setModulosHabilitados([...MODULOS]));
  }, [empresaAtual.id]);

  const trocarEmpresa = (e: Empresa) => {
    setEmpresaAtual({ id: e.id, nome: e.nome_fantasia });
    setTotalFuncionarios(null);
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

      <AppHeader
        right={EmpresaSelector}
        topBar={
          getPerfil() === 'dev' ? (
            <TouchableOpacity
              className="flex-row items-center gap-1"
              onPress={() => router.replace('/select-empresa' as any)}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text className="text-xs text-gray-500 dark:text-gray-400">Selecionar empresa</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={{ padding: isMobile ? 16 : 24, paddingTop: isMobile ? 20 : 32, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1200 }}>

          {/* Saudação */}
          <Text className="text-xl font-semibold text-[#2B3674] dark:text-white mb-5">
            Olá, {getNome().split(' ')[0]}! Bem-vindo a{' '}
            <Text className="font-bold">{empresaAtual.nome}</Text>
          </Text>

          {/* Cards row */}
          <View style={{ flexDirection: isMobile ? 'column' : 'row', gap: 16, flexWrap: 'wrap' }}>

            {/* Card Funcionários */}
            {modulosHabilitados.includes('funcionarios') && <View style={{
              width: isMobile ? '100%' : 300,
              height: isMobile ? undefined : 300,
              backgroundColor: isDark ? '#1C1F2E' : '#fff',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? '#374151' : '#e2e5ea',
              padding: isMobile ? 16 : 24,
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
                <Text style={{ fontSize: 62, fontWeight: '700', color: isDark ? '#fff' : '#1e2d6e', lineHeight: 56 }}>
                  {totalFuncionarios ?? '—'}
                </Text>
                <Text style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>
                  Funcionários
                </Text>
              </View>

              {/* Botão */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#3b5fe0',
                  borderRadius: 8,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/funcionarios' as any, params: { empresaId: encodeId(empresaAtual.id), empresaName: empresaAtual.nome, grupoId: encodeId(grupoId) } })}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Acessar</Text>
              </TouchableOpacity>
            </View>}

            {/* Card Controle de Ponto */}
            {modulosHabilitados.includes('pontos') && <View style={{
              width: isMobile ? '100%' : 300,
              height: isMobile ? undefined : 300,
              backgroundColor: isDark ? '#1C1F2E' : '#fff',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? '#374151' : '#e2e5ea',
              padding: isMobile ? 16 : 24,
              gap: 16,
              justifyContent: 'space-between',
            }}>
              {/* Ícone + Data */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: '#fef3c7',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="time-outline" size={24} color="#d97706" />
                </View>
                <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
              </View>

              {/* Título */}
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: isDark ? '#fff' : '#1e2d6e' }}>
                  Ponto
                </Text>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>
                  Controle de jornada e horas
                </Text>
              </View>

              {/* Botão */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#d97706',
                  borderRadius: 8,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/ponto' as any, params: { empresaId: encodeId(empresaAtual.id), empresaName: empresaAtual.nome } })}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Acessar</Text>
              </TouchableOpacity>
            </View>}

            {/* Card Financeiro */}
            <View style={{
              width: isMobile ? '100%' : 300,
              height: isMobile ? undefined : 300,
              backgroundColor: isDark ? '#1C1F2E' : '#fff',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? '#374151' : '#e2e5ea',
              padding: isMobile ? 16 : 24,
              gap: 16,
              justifyContent: 'space-between',
            }}>
              {/* Ícone + Data */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: '#dcfce7',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name="wallet-outline" size={24} color="#16a34a" />
                </View>
                <Text style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
              </View>

              {/* Título */}
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: isDark ? '#fff' : '#1e2d6e' }}>
                  Financeiro
                </Text>
                <Text style={{ fontSize: 14, color: '#6b7280' }}>
                  Relatórios, contas e fluxo de caixa
                </Text>
              </View>

              {/* Botão */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#16a34a',
                  borderRadius: 8,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/financeiro' as any, params: { empresaId: encodeId(empresaAtual.id), empresaName: empresaAtual.nome, grupoId: encodeId(grupoId) } })}
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
