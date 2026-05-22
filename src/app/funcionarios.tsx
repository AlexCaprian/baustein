import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { AppHeader } from '@/components/layout/app-header';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { api, getPerfil, Usuario, UsuarioInput } from '../services/api';

const PERFIS = ['funcionario', 'admin'] as const;

const PERFIL_LABEL: Record<string, string> = {
  funcionario: 'Funcionário',
  admin: 'Admin',
  dev: 'Dev',
};

const PERFIL_COLORS: Record<string, { bg: string; bgDark: string; text: string }> = {
  funcionario: { bg: '#eff6ff', bgDark: '#1e3a5f', text: '#3b5fe0' },
  admin:       { bg: '#fefce8', bgDark: '#3b2a05', text: '#ca8a04' },
  dev:         { bg: '#f0fdf4', bgDark: '#052e16', text: '#16a34a' },
};

const AVATAR_COLORS = ['#3b5fe0', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];

const EMPTY_FORM = { nome: '', username: '', email: '', senha: '', perfil: 'funcionario' };

function avatarColor(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function FuncionariosScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ empresaId: string; empresaName: string; grupoId: string }>();
  const empresaId = Number(params.empresaId);
  const empresaName = params.empresaName ?? 'Empresa';
  const isDev = getPerfil() === 'dev';

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPerfil, setFilterPerfil] = useState('todos');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showSenha, setShowSenha] = useState(false);
  const [erro, setErro] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.usuarios.list();
      setUsuarios((res.usuarios ?? []).filter(u => u.empresa_id === empresaId));
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => usuarios.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      u.nome.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);
    const matchPerfil = filterPerfil === 'todos' || u.perfil === filterPerfil;
    return matchSearch && matchPerfil;
  }), [usuarios, search, filterPerfil]);

  const openModal = () => {
    setForm(EMPTY_FORM);
    setErro('');
    setShowSenha(false);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.username.trim() || !form.email.trim() || !form.senha.trim()) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    setErro('');
    try {
      await api.usuarios.create({ ...form, empresa_id: empresaId });
      setModalVisible(false);
      load();
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao cadastrar funcionário.');
    } finally {
      setSaving(false);
    }
  };

  const ph = isDark ? '#4b5563' : '#bbb';

  const filterOptions = [{ key: 'todos', label: 'Todos' }, ...PERFIS.map(p => ({ key: p, label: PERFIL_LABEL[p] }))];

  return (
    <View className="flex-1 bg-slate-100 dark:bg-gray-950">
      <AppHeader
        right={
          <TouchableOpacity
            className="flex-row items-center gap-1.5 bg-[#3b5fe0] px-3.5 py-2 rounded-lg"
            onPress={openModal}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text className="text-white text-sm font-semibold">Novo Funcionário</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1200 }}>

          {/* Navegação */}
          <View className="flex-row items-center gap-2 mb-5">
            <TouchableOpacity
              className="flex-row items-center gap-1.5 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900"
              onPress={() => router.push({ pathname: '/hub', params: { empresaId: params.empresaId, empresaName: params.empresaName, grupoId: params.grupoId } } as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back-outline" size={15} color={isDark ? '#9ca3af' : '#6b7280'} />
              <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">Voltar ao Hub</Text>
            </TouchableOpacity>
            {isDev && (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900"
                onPress={() => router.replace('/select-empresa' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="business-outline" size={15} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">Selecionar Empresa</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Título */}
          <View className="mb-5">
            <Text className="text-xl font-semibold text-[#2B3674] dark:text-white">Funcionários</Text>
            <Text className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {empresaName} · {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Busca + filtros */}
          <View className="flex-row items-center gap-3 mb-4 flex-wrap">
            <View className="flex-1 flex-row items-center gap-2 h-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3" style={{ minWidth: 200 }}>
              <Ionicons name="search-outline" size={16} color={isDark ? '#4b5563' : '#9ca3af'} />
              <TextInput
                className="flex-1 text-sm text-gray-800 dark:text-gray-100"
                style={{ outline: 'none' } as any}
                placeholder="Buscar por nome, usuário ou e-mail..."
                placeholderTextColor={ph}
                value={search}
                onChangeText={setSearch}
              />
              {!!search && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-row gap-2">
              {filterOptions.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setFilterPerfil(opt.key)}
                  className={`h-10 px-4 rounded-lg border items-center justify-center ${
                    filterPerfil === opt.key
                      ? 'bg-[#3b5fe0] border-[#3b5fe0]'
                      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                  }`}
                  activeOpacity={0.8}
                >
                  <Text className={`text-sm font-medium ${filterPerfil === opt.key ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Toggle tabela / grid */}
            <View className="flex-row border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
              <TouchableOpacity
                className={`w-10 h-10 items-center justify-center ${viewMode === 'table' ? 'bg-[#3b5fe0]' : ''}`}
                onPress={() => setViewMode('table')}
                activeOpacity={0.8}
              >
                <Ionicons name="list-outline" size={18} color={viewMode === 'table' ? '#fff' : isDark ? '#6b7280' : '#9ca3af'} />
              </TouchableOpacity>
              <TouchableOpacity
                className={`w-10 h-10 items-center justify-center ${viewMode === 'grid' ? 'bg-[#3b5fe0]' : ''}`}
                onPress={() => setViewMode('grid')}
                activeOpacity={0.8}
              >
                <Ionicons name="grid-outline" size={18} color={viewMode === 'grid' ? '#fff' : isDark ? '#6b7280' : '#9ca3af'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Estado vazio */}
          {filtered.length === 0 && (
            <View className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 items-center justify-center py-16 gap-3">
              <Ionicons name="people-outline" size={44} color={isDark ? '#374151' : '#d1d5db'} />
              <Text className="text-sm text-gray-400 dark:text-gray-600">
                {search || filterPerfil !== 'todos'
                  ? 'Nenhum resultado para os filtros aplicados'
                  : 'Nenhum funcionário cadastrado nesta empresa'}
              </Text>
              {!search && filterPerfil === 'todos' && (
                <TouchableOpacity className="mt-1 bg-[#3b5fe0] px-5 py-2.5 rounded-lg" onPress={openModal} activeOpacity={0.85}>
                  <Text className="text-white text-sm font-semibold">Cadastrar primeiro funcionário</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Modo tabela */}
          {viewMode === 'table' && filtered.length > 0 && (
            <View className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <View className="flex-row items-center px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                <View style={{ width: 52 }} />
                <Text className="flex-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Nome</Text>
                <Text style={{ width: 150 }} className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Usuário</Text>
                <Text style={{ width: 220 }} className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">E-mail</Text>
                <Text style={{ width: 110 }} className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Perfil</Text>
              </View>
              {filtered.map((u, idx) => {
                const color = avatarColor(u.nome);
                const perf = PERFIL_COLORS[u.perfil] ?? { bg: '#f3f4f6', bgDark: '#1f2937', text: '#6b7280' };
                return (
                  <View key={u.id} className={`flex-row items-center px-5 py-3.5 ${idx < filtered.length - 1 ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{initials(u.nome)}</Text>
                    </View>
                    <Text className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100" numberOfLines={1}>{u.nome}</Text>
                    <Text style={{ width: 150 }} className="text-sm text-gray-400 dark:text-gray-500" numberOfLines={1}>@{u.username}</Text>
                    <Text style={{ width: 220 }} className="text-sm text-gray-400 dark:text-gray-500" numberOfLines={1}>{u.email}</Text>
                    <View style={{ width: 110 }}>
                      <View style={{ backgroundColor: isDark ? perf.bgDark : perf.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' }}>
                        <Text style={{ color: perf.text, fontSize: 12, fontWeight: '600' }}>{PERFIL_LABEL[u.perfil] ?? u.perfil}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Modo grid */}
          {viewMode === 'grid' && filtered.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
              {filtered.map((u) => {
                const color = avatarColor(u.nome);
                const perf = PERFIL_COLORS[u.perfil] ?? { bg: '#f3f4f6', bgDark: '#1f2937', text: '#6b7280' };
                return (
                  <View
                    key={u.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
                    style={{ width: 220, gap: 12 }}
                  >
                    {/* Avatar grande */}
                    <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{initials(u.nome)}</Text>
                    </View>
                    {/* Info */}
                    <View style={{ gap: 4 }}>
                      <Text className="text-sm font-bold text-gray-800 dark:text-gray-100" numberOfLines={1}>{u.nome}</Text>
                      <Text className="text-xs text-gray-400 dark:text-gray-500" numberOfLines={1}>@{u.username}</Text>
                      <Text className="text-xs text-gray-400 dark:text-gray-500" numberOfLines={1}>{u.email}</Text>
                    </View>
                    {/* Badge perfil */}
                    <View style={{ backgroundColor: isDark ? perf.bgDark : perf.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' }}>
                      <Text style={{ color: perf.text, fontSize: 12, fontWeight: '600' }}>{PERFIL_LABEL[u.perfil] ?? u.perfil}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

        </View>
      </ScrollView>

      {/* Modal novo funcionário */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 440 }}>
            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-5">Novo Funcionário</Text>

            {/* Nome */}
            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Nome completo *</Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={form.nome}
                onChangeText={v => setForm(p => ({ ...p, nome: v }))}
                placeholder="Ex: João da Silva"
                placeholderTextColor={ph}
                autoFocus
              />
            </View>

            <View className="flex-row gap-3 mb-3">
              {/* Username */}
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Usuário *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={form.username}
                  onChangeText={v => setForm(p => ({ ...p, username: v.toLowerCase().replace(/\s/g, '') }))}
                  placeholder="joaosilva"
                  placeholderTextColor={ph}
                  autoCapitalize="none"
                />
              </View>
              {/* Senha */}
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Senha *</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderColor: isDark ? '#4b5563' : '#d1d5db', borderRadius: 8, backgroundColor: isDark ? '#111827' : '#fff', overflow: 'hidden' }}>
                  <TextInput
                    style={{ flex: 1, minWidth: 0, paddingHorizontal: 12, fontSize: 14, color: isDark ? '#f3f4f6' : '#1f2937', outline: 'none' } as any}
                    value={form.senha}
                    onChangeText={v => setForm(p => ({ ...p, senha: v }))}
                    placeholder="••••••••"
                    placeholderTextColor={ph}
                    secureTextEntry={!showSenha}
                  />
                  <TouchableOpacity style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => setShowSenha(v => !v)}>
                    <Ionicons name={showSenha ? 'eye-outline' : 'eye-off-outline'} size={18} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">E-mail *</Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={form.email}
                onChangeText={v => setForm(p => ({ ...p, email: v }))}
                placeholder="joao@empresa.com"
                placeholderTextColor={ph}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Perfil */}
            <View className="mb-5">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Perfil</Text>
              <View className="flex-row gap-2">
                {PERFIS.map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setForm(f => ({ ...f, perfil: p }))}
                    className={`flex-1 h-10 rounded-lg border items-center justify-center ${
                      form.perfil === p
                        ? 'bg-[#3b5fe0] border-[#3b5fe0]'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                    }`}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-sm font-medium ${form.perfil === p ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                      {PERFIL_LABEL[p]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Erro */}
            {!!erro && (
              <View className="flex-row items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2.5 mb-4">
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text className="flex-1 text-xs text-red-600 dark:text-red-400">{erro}</Text>
              </View>
            )}

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setModalVisible(false)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center ${saving ? 'opacity-50' : ''}`}
                onPress={handleSave}
                disabled={saving}
              >
                <Text className="text-sm font-semibold text-white">Cadastrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LoadingOverlay visible={loading || saving} message={saving ? 'Cadastrando' : undefined} />
    </View>
  );
}
