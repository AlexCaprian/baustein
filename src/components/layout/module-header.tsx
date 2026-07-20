import React, { useCallback, useEffect, useState } from 'react';
import { router, usePathname } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { AppHeader } from '@/components/layout/app-header';
import { api, Empresa, getPerfil, getUserId } from '@/services/api';
import { encodeId } from '@/services/idHash';

interface ModuleHeaderProps {
  title: string;
  empresaId: number;
  empresaName: string;
  grupoId: number;
  right?: React.ReactNode;
  titleBarRight?: React.ReactNode;
}

export function ModuleHeader({ title, empresaId, empresaName, grupoId, right, titleBarRight }: ModuleHeaderProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const pathname = usePathname();

  const isDev = getPerfil() === 'dev';
  const isMaster = getPerfil() === 'master';

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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

  const loadEmpresasUsuario = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;
    setLoadingEmpresas(true);
    try {
      const res = await api.usuarios.empresas(userId);
      setEmpresas(res.empresas ?? []);
    } catch {
      // silencioso — dropdown só não mostra outras empresas
    } finally {
      setLoadingEmpresas(false);
    }
  }, []);

  useEffect(() => {
    if (isDev || isMaster) {
      if (grupoId) loadEmpresas(grupoId);
    } else {
      loadEmpresasUsuario();
    }
  }, [grupoId, isDev, isMaster, loadEmpresas, loadEmpresasUsuario]);

  function trocarEmpresa(e: Empresa) {
    setDropdownOpen(false);
    if (e.id === empresaId) return;
    router.replace({
      pathname: pathname as any,
      params: { empresaId: encodeId(e.id), empresaName: e.nome_fantasia, grupoId: encodeId(e.grupo_id) },
    });
  }

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
          {empresaName}
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
              Nenhuma empresa disponível
            </Text>
          ) : (
            !loadingEmpresas && empresas.map((e) => {
              const ativa = e.id === empresaId;
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
    <>
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
        right={
          <View className="flex-row items-center gap-3">
            {right}
            {EmpresaSelector}
          </View>
        }
        topBar={
          isDev ? (
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

      {/* Título + back */}
      <View className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-row items-center gap-2.5 px-5 py-3">
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/hub' as any, params: { empresaId: encodeId(empresaId), empresaName, grupoId: encodeId(grupoId) } })}
          style={{ padding: 6, borderRadius: 8, backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#fff' : '#1e2d6e' }}>
          {title}
        </Text>
        {titleBarRight && (
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            {titleBarRight}
          </View>
        )}
      </View>
    </>
  );
}
