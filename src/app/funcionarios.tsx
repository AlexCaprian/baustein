import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { AppHeader } from '@/components/layout/app-header';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { api, getPerfil, Usuario, UsuarioInput } from '../services/api';

const PAGE_LIMIT = 20;

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

const EMPTY_FORM = { nome: '', username: '', email: '', senha: '', perfil: 'funcionario', hora_trabalha: '08:00' };

function parseHT(s: string): number {
  const [h, m] = s.split(':').map(v => parseInt(v, 10) || 0);
  const v = h + m / 60;
  return v > 0 ? v : 8;
}

function fmtHT(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${mm > 0 ? mm + 'm' : ''}`;
}

function htToInput(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

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
  const { width } = useWindowDimensions();
  const isMobile = width < 640;
  const contentWidth = width - (isMobile ? 32 : 48);
  const cardW = isMobile ? Math.floor((contentWidth - 16) / 2) : 220;
  const params = useLocalSearchParams<{ empresaId: string; empresaName: string; grupoId: string }>();
  const empresaId = Number(params.empresaId);
  const empresaName = params.empresaName ?? 'Empresa';
  const isDev = getPerfil() === 'dev';

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterPerfil, setFilterPerfil] = useState('todos');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(isMobile ? 'grid' : 'table');
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Usuario | null>(null);
  const [deleteReason, setDeleteReason] = useState<'delecao' | 'demissao'>('delecao');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [userToEdit, setUserToEdit] = useState<Usuario | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [showEditSenha, setShowEditSenha] = useState(false);
  const [editErro, setEditErro] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [showSenha, setShowSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce da busca: espera 400ms após o usuário parar de digitar
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.usuarios.list({
        empresaId,
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setUsuarios(res.usuarios ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  }, [empresaId, debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  // Filtro de perfil aplicado client-side dentro da página atual
  const filtered = useMemo(() => usuarios.filter(u =>
    filterPerfil === 'todos' || u.perfil === filterPerfil
  ), [usuarios, filterPerfil]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

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
      await api.usuarios.create({ ...form, empresa_id: empresaId, hora_trabalha: parseHT(form.hora_trabalha) });
      setModalVisible(false);
      load();
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao cadastrar funcionário.');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (u: Usuario) => {
    setUserToEdit(u);
    setEditForm({ nome: u.nome, username: u.username, email: u.email, senha: '', perfil: u.perfil, hora_trabalha: htToInput(u.hora_trabalha ?? 8) });
    setEditErro('');
    setShowEditSenha(false);
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!userToEdit) return;
    if (!editForm.nome.trim() || !editForm.username.trim() || !editForm.email.trim()) {
      setEditErro('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);
    setEditErro('');
    try {
      const data: Partial<UsuarioInput> = {
        nome: editForm.nome,
        username: editForm.username,
        email: editForm.email,
        perfil: editForm.perfil,
        hora_trabalha: parseHT(editForm.hora_trabalha),
      };
      if (editForm.senha.trim()) data.senha = editForm.senha;
      await api.usuarios.update(userToEdit.id, data);
      setEditModalVisible(false);
      setUserToEdit(null);
      load();
    } catch (e: any) {
      setEditErro(e.message ?? 'Erro ao atualizar funcionário.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setSaving(true);
    try {
      await api.usuarios.delete(userToDelete.id, deleteReason);
      setDeleteModalVisible(false);
      setUserToDelete(null);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
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
            className="flex-row items-center gap-1.5 bg-[#3b5fe0] rounded-lg"
            style={{ paddingHorizontal: isMobile ? 10 : 14, paddingVertical: 8 }}
            onPress={openModal}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#fff" />
            {!isMobile && <Text className="text-white text-sm font-semibold">Novo Funcionário</Text>}
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 1200, alignSelf: 'center' }}>

          {/* Título + back */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/hub', params: { empresaId: params.empresaId, empresaName: params.empresaName, grupoId: params.grupoId } } as any)}
              style={{ padding: 6, borderRadius: 8, backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#fff' : '#1e2d6e' }}>
              Funcionários
            </Text>
            {isDev && (
              <TouchableOpacity
                onPress={() => router.replace('/select-empresa' as any)}
                style={{ marginLeft: 'auto', padding: 6, borderRadius: 8, backgroundColor: isDark ? '#1f2937' : '#f1f5f9' }}
                activeOpacity={0.7}
              >
                <Ionicons name="business-outline" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
            )}
          </View>

          {/* Busca + filtros */}
          <View className="mb-4" style={{ gap: 8 }}>
            {/* Linha 1: busca */}
            <View className="flex-row items-center gap-2 h-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3">
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

            {/* Linha 2: filtros + toggle */}
            <View className="flex-row items-center gap-2">
              <View className="flex-row gap-2 flex-1 flex-wrap">
                {filterOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setFilterPerfil(opt.key)}
                    className={`h-9 px-3 rounded-lg border items-center justify-center ${
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
                  className={`w-9 h-9 items-center justify-center ${viewMode === 'table' ? 'bg-[#3b5fe0]' : ''}`}
                  onPress={() => setViewMode('table')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="list-outline" size={18} color={viewMode === 'table' ? '#fff' : isDark ? '#6b7280' : '#9ca3af'} />
                </TouchableOpacity>
                <TouchableOpacity
                  className={`w-9 h-9 items-center justify-center ${viewMode === 'grid' ? 'bg-[#3b5fe0]' : ''}`}
                  onPress={() => setViewMode('grid')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="grid-outline" size={18} color={viewMode === 'grid' ? '#fff' : isDark ? '#6b7280' : '#9ca3af'} />
                </TouchableOpacity>
              </View>
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
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={isMobile} 
              nestedScrollEnabled 
              style={{ borderRadius: 12 }}
              contentContainerStyle={!isMobile ? { flex: 1 } : undefined}
            >
              <View 
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden" 
                style={{ width: '100%', minWidth: isMobile ? 580 : undefined }}
              >
                <View className="flex-row items-center px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                  <View style={{ width: 52 }} />
                  <Text className="flex-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Nome</Text>
                  <Text style={{ width: 150 }} className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Usuário</Text>
                  <Text style={{ width: 220 }} className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">E-mail</Text>
                  <Text style={{ width: 110 }} className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Perfil</Text>
                  <Text style={{ width: 72 }} className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">H. Dia</Text>
                  <View style={{ width: 80 }} />
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
                      <Text style={{ width: 72, fontSize: 12, color: isDark ? '#9ca3af' : '#6b7280' }} numberOfLines={1}>{fmtHT(u.hora_trabalha ?? 8)}/dia</Text>
                      <View style={{ width: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        <TouchableOpacity
                          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: isDark ? '#1e3a5f' : '#eff6ff' }}
                          onPress={() => openEditModal(u)}
                        >
                          <Ionicons name="create-outline" size={16} color="#3b5fe0" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: isDark ? '#3b0f0f' : '#fff1f2' }}
                          onPress={() => { setUserToDelete(u); setDeleteReason('delecao'); setDeleteModalVisible(true); }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
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
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
                    style={{ width: cardW, gap: 12 }}
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
                    {/* Badge perfil + h/dia */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <View style={{ backgroundColor: isDark ? perf.bgDark : perf.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                        <Text style={{ color: perf.text, fontSize: 12, fontWeight: '600' }}>{PERFIL_LABEL[u.perfil] ?? u.perfil}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af' }}>{fmtHT(u.hora_trabalha ?? 8)}/dia</Text>
                    </View>
                    {/* Ações */}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={{ flex: 1, height: 34, borderRadius: 8, backgroundColor: isDark ? '#1e3a5f' : '#eff6ff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}
                        onPress={() => openEditModal(u)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="create-outline" size={14} color="#3b5fe0" />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#3b5fe0' }}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: isDark ? '#3b0f0f' : '#fff1f2', alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => { setUserToDelete(u); setDeleteReason('delecao'); setDeleteModalVisible(true); }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <View className="flex-row items-center justify-center gap-4 mt-6">
              <TouchableOpacity
                onPress={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`flex-row items-center gap-1.5 px-4 py-2 rounded-lg border ${
                  page === 1
                    ? 'border-gray-200 dark:border-gray-700 opacity-40'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                }`}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back-outline" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">Anterior</Text>
              </TouchableOpacity>

              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {page} / {totalPages}
              </Text>

              <TouchableOpacity
                onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`flex-row items-center gap-1.5 px-4 py-2 rounded-lg border ${
                  page === totalPages
                    ? 'border-gray-200 dark:border-gray-700 opacity-40'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                }`}
                activeOpacity={0.8}
              >
                <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">Próxima</Text>
                <Ionicons name="chevron-forward-outline" size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
              </TouchableOpacity>
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

            {/* Email + Horas/dia */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
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
              <View style={{ width: 100 }}>
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Horas / dia</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none', textAlign: 'center' } as any}
                  value={form.hora_trabalha}
                  onChangeText={v => {
                    const digits = v.replace(/\D/g, '').slice(0, 4);
                    const f = digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
                    setForm(p => ({ ...p, hora_trabalha: f }));
                  }}
                  placeholder="08:00"
                  placeholderTextColor={ph}
                  maxLength={5}
                  keyboardType="numeric"
                />
              </View>
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

      {/* Modal Editar Funcionário */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 440 }}>
            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-5">Editar Funcionário</Text>

            {/* Nome */}
            <View className="mb-3">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Nome completo *</Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={editForm.nome}
                onChangeText={v => setEditForm(p => ({ ...p, nome: v }))}
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
                  value={editForm.username}
                  onChangeText={v => setEditForm(p => ({ ...p, username: v.toLowerCase().replace(/\s/g, '') }))}
                  placeholder="joaosilva"
                  placeholderTextColor={ph}
                  autoCapitalize="none"
                />
              </View>
              {/* Nova Senha */}
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Nova senha</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1, borderColor: isDark ? '#4b5563' : '#d1d5db', borderRadius: 8, backgroundColor: isDark ? '#111827' : '#fff', overflow: 'hidden' }}>
                  <TextInput
                    style={{ flex: 1, minWidth: 0, paddingHorizontal: 12, fontSize: 14, color: isDark ? '#f3f4f6' : '#1f2937', outline: 'none' } as any}
                    value={editForm.senha}
                    onChangeText={v => setEditForm(p => ({ ...p, senha: v }))}
                    placeholder="vazio = sem alterar"
                    placeholderTextColor={ph}
                    secureTextEntry={!showEditSenha}
                  />
                  <TouchableOpacity style={{ width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => setShowEditSenha(v => !v)}>
                    <Ionicons name={showEditSenha ? 'eye-outline' : 'eye-off-outline'} size={18} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Email + Horas/dia */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">E-mail *</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none' } as any}
                  value={editForm.email}
                  onChangeText={v => setEditForm(p => ({ ...p, email: v }))}
                  placeholder="joao@empresa.com"
                  placeholderTextColor={ph}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ width: 100 }}>
                <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Horas / dia</Text>
                <TextInput
                  className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                  style={{ outline: 'none', textAlign: 'center' } as any}
                  value={editForm.hora_trabalha}
                  onChangeText={v => {
                    const digits = v.replace(/\D/g, '').slice(0, 4);
                    const f = digits.length > 2 ? digits.slice(0, 2) + ':' + digits.slice(2) : digits;
                    setEditForm(p => ({ ...p, hora_trabalha: f }));
                  }}
                  placeholder="08:00"
                  placeholderTextColor={ph}
                  maxLength={5}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Perfil */}
            <View className="mb-5">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Perfil</Text>
              <View className="flex-row gap-2">
                {PERFIS.map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setEditForm(f => ({ ...f, perfil: p }))}
                    className={`flex-1 h-10 rounded-lg border items-center justify-center ${
                      editForm.perfil === p
                        ? 'bg-[#3b5fe0] border-[#3b5fe0]'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
                    }`}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-sm font-medium ${editForm.perfil === p ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                      {PERFIL_LABEL[p]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Erro */}
            {!!editErro && (
              <View className="flex-row items-center gap-1.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2.5 mb-4">
                <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
                <Text className="flex-1 text-xs text-red-600 dark:text-red-400">{editErro}</Text>
              </View>
            )}

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setEditModalVisible(false)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center ${saving ? 'opacity-50' : ''}`}
                onPress={handleUpdate}
                disabled={saving}
              >
                <Text className="text-sm font-semibold text-white">Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Confirmar Deleção */}
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 400 }}>
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 items-center justify-center mb-3">
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
              </View>
              <Text className="text-lg font-bold text-gray-800 dark:text-white">Confirmar Deleção</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
                Você está prestes a remover o usuário <Text className="font-bold text-gray-700 dark:text-gray-200">{userToDelete?.nome}</Text>.
              </Text>
            </View>

            <View className="mb-6">
              <Text className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2.5">Selecione o motivo:</Text>
              <View className="gap-2">
                <TouchableOpacity
                  onPress={() => setDeleteReason('delecao')}
                  className={`flex-row items-center gap-3 p-3 rounded-xl border ${
                    deleteReason === 'delecao'
                      ? 'bg-blue-50 dark:bg-blue-950/20 border-[#3b5fe0]'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                  }`}
                  activeOpacity={0.8}
                >
                  <View className={`w-4 h-4 rounded-full border items-center justify-center ${deleteReason === 'delecao' ? 'border-[#3b5fe0]' : 'border-gray-300'}`}>
                    {deleteReason === 'delecao' && <View className="w-2 h-2 rounded-full bg-[#3b5fe0]" />}
                  </View>
                  <View>
                    <Text className={`text-sm font-semibold ${deleteReason === 'delecao' ? 'text-[#3b5fe0]' : 'text-gray-700 dark:text-gray-300'}`}>Erro de Cadastro / Deleção</Text>
                    <Text className="text-xs text-gray-400">Remover registro indevido ou duplicado</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setDeleteReason('demissao')}
                  className={`flex-row items-center gap-3 p-3 rounded-xl border ${
                    deleteReason === 'demissao'
                      ? 'bg-blue-50 dark:bg-blue-950/20 border-[#3b5fe0]'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                  }`}
                  activeOpacity={0.8}
                >
                  <View className={`w-4 h-4 rounded-full border items-center justify-center ${deleteReason === 'demissao' ? 'border-[#3b5fe0]' : 'border-gray-300'}`}>
                    {deleteReason === 'demissao' && <View className="w-2 h-2 rounded-full bg-[#3b5fe0]" />}
                  </View>
                  <View>
                    <Text className={`text-sm font-semibold ${deleteReason === 'demissao' ? 'text-[#3b5fe0]' : 'text-gray-700 dark:text-gray-300'}`}>Demissão / Desligamento</Text>
                    <Text className="text-xs text-gray-400">Inativar acesso por saída da empresa</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => {
                  setDeleteModalVisible(false);
                  setUserToDelete(null);
                }}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 h-11 rounded-xl bg-red-500 items-center justify-center ${saving ? 'opacity-50' : ''}`}
                onPress={handleDelete}
                disabled={saving}
              >
                <Text className="text-sm font-semibold text-white">Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LoadingOverlay visible={loading || saving} message={saving ? 'Cadastrando' : undefined} />
    </View>
  );
}
