import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { api, AcessoUsuario, Empresa, EmpresaInput, Grupo, MODULOS, MODULOS_INFO, getPerfil } from '../services/api';
import { encodeId } from '../services/idHash';
import { AppHeader } from '@/components/layout/app-header';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { ConfirmDeleteModal } from '@/components/ui/confirm-delete-modal';

// ─── Types ────────────────────────────────────────────────────────────────────

type GrupoModal = { visible: boolean; editing: Grupo | null; nome: string };
type EmpresaModal = {
  visible: boolean;
  editing: Empresa | null;
  grupoId: number | null;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
};
type ModulosModal = {
  visible: boolean;
  empresa: Empresa | null;
  modulos: string[];
  isDefault: boolean;
};
type AcessosModal = {
  visible: boolean;
  empresa: Empresa | null;
  usuarios: AcessoUsuario[];
};

const EMPTY_GRUPO: GrupoModal = { visible: false, editing: null, nome: '' };
const EMPTY_EMPRESA: EmpresaModal = {
  visible: false, editing: null, grupoId: null,
  nome_fantasia: '', razao_social: '', cnpj: '',
};
const EMPTY_MODULOS: ModulosModal = { visible: false, empresa: null, modulos: [], isDefault: true };
const EMPTY_ACESSOS: AcessosModal = { visible: false, empresa: null, usuarios: [] };

const PERFIL_COLORS: Record<string, { bg: string; bgDark: string; text: string }> = {
  funcionario: { bg: '#eff6ff', bgDark: '#1e3a5f', text: '#3b5fe0' },
  admin:       { bg: '#fefce8', bgDark: '#3b2a05', text: '#ca8a04' },
};

const PERFIL_LABEL: Record<string, string> = {
  funcionario: 'Funcionário',
  admin: 'Admin',
};

function maskCNPJ(value: string): string {
  const clean = value.replace(/[.\-/]/g, '').slice(0, 14);
  return clean
    .replace(/^(.{2})(.+)/, '$1.$2')
    .replace(/^(.{2}\..{3})(.+)/, '$1.$2')
    .replace(/^(.{2}\..{3}\..{3})(.+)/, '$1/$2')
    .replace(/^(.{2}\..{3}\..{3}\/.{4})(.+)/, '$1-$2');
}

function validateCNPJ(cnpj: string): boolean {
  return cnpj.replace(/[.\-/]/g, '').trim().length === 14;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SelectEmpresaScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isMobile = width < 640;

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [empresasByGrupo, setEmpresasByGrupo] = useState<Record<number, Empresa[]>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [grupoModal, setGrupoModal] = useState<GrupoModal>(EMPTY_GRUPO);
  const [empresaModal, setEmpresaModal] = useState<EmpresaModal>(EMPTY_EMPRESA);
  const [modulosModal, setModulosModal] = useState<ModulosModal>(EMPTY_MODULOS);
  const [acessosModal, setAcessosModal] = useState<AcessosModal>(EMPTY_ACESSOS);
  const [loadingAcessos, setLoadingAcessos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [grupoToDelete, setGrupoToDelete] = useState<Grupo | null>(null);
  const [empresaToDelete, setEmpresaToDelete] = useState<Empresa | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isDev = getPerfil() === 'dev';
  const isMaster = getPerfil() === 'master';
  const canManage = isDev || isMaster;

  // ─── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await api.grupos.list();
      const gs = res.grupos ?? [];
      setGrupos(gs);
      const map: Record<number, Empresa[]> = {};
      await Promise.all(gs.map(async (g) => {
        const er = await api.empresas.list(g.id);
        map[g.id] = er.empresas ?? [];
      }));
      setEmpresasByGrupo(map);
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: number) =>
    setExpanded(p => ({ ...p, [id]: p[id] === false ? true : false }));

  const isExpanded = (id: number) => expanded[id] !== false;

  // ─── Grupo CRUD ────────────────────────────────────────────────────────────

  const saveGrupo = async () => {
    if (!grupoModal.nome.trim()) return;
    setSaving(true);
    try {
      if (grupoModal.editing) {
        await api.grupos.update(grupoModal.editing.id, grupoModal.nome.trim());
      } else {
        await api.grupos.create(grupoModal.nome.trim());
      }
      setGrupoModal(EMPTY_GRUPO);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteGrupo = (g: Grupo) => setGrupoToDelete(g);

  const handleDeleteGrupo = async () => {
    if (!grupoToDelete) return;
    setDeleting(true);
    try {
      await api.grupos.delete(grupoToDelete.id);
      setGrupoToDelete(null);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Empresa CRUD ──────────────────────────────────────────────────────────

  const saveEmpresa = async () => {
    const { editing, grupoId, nome_fantasia, razao_social, cnpj } = empresaModal;
    if (!nome_fantasia.trim() || !razao_social.trim() || !grupoId || !validateCNPJ(cnpj)) return;
    setSaving(true);
    try {
      const data: EmpresaInput = {
        grupo_id: grupoId,
        nome_fantasia: nome_fantasia.trim(),
        razao_social: razao_social.trim(),
        cnpj: cnpj.replace(/[.\-/]/g, ''),
      };
      if (editing) {
        await api.empresas.update(editing.id, data);
      } else {
        await api.empresas.create(data);
      }
      setEmpresaModal(EMPTY_EMPRESA);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteEmpresa = (e: Empresa) => setEmpresaToDelete(e);

  const handleDeleteEmpresa = async () => {
    if (!empresaToDelete) return;
    setDeleting(true);
    try {
      await api.empresas.delete(empresaToDelete.id);
      setEmpresaToDelete(null);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setDeleting(false);
    }
  };

  const selectEmpresa = (e: Empresa) =>
    router.replace({ pathname: '/hub', params: { empresaId: encodeId(e.id), empresaName: e.nome_fantasia, grupoId: encodeId(e.grupo_id) } } as any);

  // ─── Módulos CRUD ──────────────────────────────────────────────────────────

  const openModulosModal = async (emp: Empresa) => {
    try {
      const res = await api.modulos.get(emp.id);
      setModulosModal({ visible: true, empresa: emp, modulos: res.modulos, isDefault: res.is_default });
    } catch {
      setModulosModal({ visible: true, empresa: emp, modulos: [...MODULOS], isDefault: true });
    }
  };

  const toggleModulo = (modulo: string) => {
    setModulosModal(p => ({
      ...p,
      isDefault: false,
      modulos: p.modulos.includes(modulo)
        ? p.modulos.filter(m => m !== modulo)
        : [...p.modulos, modulo],
    }));
  };

  const saveModulos = async () => {
    if (!modulosModal.empresa) return;
    setSaving(true);
    try {
      await api.modulos.set(modulosModal.empresa.id, modulosModal.modulos);
      setModulosModal(EMPTY_MODULOS);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Acessos ────────────────────────────────────────────────────────────

  const openAcessosModal = async (emp: Empresa) => {
    setAcessosModal({ visible: true, empresa: emp, usuarios: [] });
    setLoadingAcessos(true);
    try {
      const res = await api.empresas.acessos.get(emp.id);
      setAcessosModal({ visible: true, empresa: emp, usuarios: res.usuarios ?? [] });
    } catch (e: any) {
      Alert.alert('Erro', e.message);
      setAcessosModal(EMPTY_ACESSOS);
    } finally {
      setLoadingAcessos(false);
    }
  };

  const toggleAcesso = (usuarioId: number) => {
    setAcessosModal(p => ({
      ...p,
      usuarios: p.usuarios.map(u =>
        u.id === usuarioId && u.empresa_id !== p.empresa?.id
          ? { ...u, tem_acesso: !u.tem_acesso }
          : u
      ),
    }));
  };

  const saveAcessos = async () => {
    if (!acessosModal.empresa) return;
    setSaving(true);
    try {
      const ids = acessosModal.usuarios.filter(u => u.tem_acesso).map(u => u.id);
      await api.empresas.acessos.set(acessosModal.empresa.id, ids);
      setAcessosModal(EMPTY_ACESSOS);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const ph = isDark ? '#4b5563' : '#bbb';

  return (
    <View className="flex-1 bg-slate-100 dark:bg-gray-950">
      <AppHeader
        right={
          <TouchableOpacity
            className="flex-row items-center gap-1.5 bg-[#3b5fe0] rounded-lg"
            style={{ paddingHorizontal: isMobile ? 10 : 14, paddingVertical: 8 }}
            onPress={() => setGrupoModal({ visible: true, editing: null, nome: '' })}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#fff" />
            {!isMobile && <Text className="text-white text-sm font-semibold">Novo Grupo</Text>}
          </TouchableOpacity>
        }
      />

      {/* States */}
      {!loading && erro ? (
        <View className="flex-1 items-center justify-center gap-3.5 p-8">
          <Text className="text-base text-red-500 text-center">{erro}</Text>
          <TouchableOpacity className="bg-[#3b5fe0] px-5 py-2.5 rounded-lg" onPress={load}>
            <Text className="text-white font-semibold text-sm">Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : !loading && grupos.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3.5 p-8">
          <Ionicons name="business-outline" size={52} color={isDark ? '#374151' : '#d1d5db'} />
          <Text className="text-base text-gray-400 dark:text-gray-600 text-center">Nenhum grupo cadastrado</Text>
          <TouchableOpacity
            className="bg-[#3b5fe0] px-5 py-2.5 rounded-lg"
            onPress={() => setGrupoModal({ visible: true, editing: null, nome: '' })}
          >
            <Text className="text-white font-semibold text-sm">Criar primeiro grupo</Text>
          </TouchableOpacity>
        </View>
      ) : !loading ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
          {grupos.map((grupo) => {
            const open = isExpanded(grupo.id);
            const empresas = empresasByGrupo[grupo.id] ?? [];
            return (
              <View key={grupo.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">

                {/* Grupo row */}
                <TouchableOpacity
                  className="flex-row items-center px-3.5 py-3 gap-2"
                  onPress={() => toggle(grupo.id)}
                  activeOpacity={0.7}
                >
                  <View className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 items-center justify-center">
                    <Text className="text-base font-bold text-[#3b5fe0] dark:text-indigo-400">
                      {grupo.nome.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text className="flex-1 text-base font-semibold text-[#1e2d6e] dark:text-white" numberOfLines={1}>
                    {grupo.nome}
                  </Text>
                  <View className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full overflow-hidden">
                    <Text className="text-xs text-gray-400 dark:text-gray-500">{empresas.length}</Text>
                  </View>
                  <TouchableOpacity className="p-1" onPress={() => setGrupoModal({ visible: true, editing: grupo, nome: grupo.nome })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="create-outline" size={17} color={isDark ? '#6b7280' : '#6b7280'} />
                  </TouchableOpacity>
                  <TouchableOpacity className="p-1" onPress={() => confirmDeleteGrupo(grupo)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={17} color="#ef4444" />
                  </TouchableOpacity>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={isDark ? '#4b5563' : '#9ca3af'} />
                </TouchableOpacity>

                {/* Empresas */}
                {open && (
                  <View className="border-t border-slate-100 dark:border-gray-800 pb-1.5">
                    {empresas.length === 0 && (
                      <Text className="text-xs text-gray-300 dark:text-gray-600 text-center py-3.5">
                        Nenhuma empresa neste grupo
                      </Text>
                    )}
                    {empresas.map((emp) => (
                      <View key={emp.id} className="flex-row items-center px-3.5 py-2.5 border-b border-gray-50 dark:border-gray-800 gap-2">
                        <TouchableOpacity className="flex-1" onPress={() => selectEmpresa(emp)} activeOpacity={0.7}>
                          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-200" numberOfLines={1}>
                            {emp.nome_fantasia}
                          </Text>
                          <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{maskCNPJ(emp.cnpj)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="bg-indigo-50 dark:bg-indigo-950 px-3 py-1.5 rounded-md"
                          onPress={() => selectEmpresa(emp)}
                          activeOpacity={0.8}
                        >
                          <Text className="text-xs font-semibold text-[#3b5fe0] dark:text-indigo-400">Entrar</Text>
                        </TouchableOpacity>
                        {canManage && (
                          <>
                            <TouchableOpacity className="p-1" onPress={() => openModulosModal(emp)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="apps-outline" size={16} color={isDark ? '#6b7280' : '#6b7280'} />
                            </TouchableOpacity>
                            <TouchableOpacity className="p-1" onPress={() => openAcessosModal(emp)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <Ionicons name="people-outline" size={16} color={isDark ? '#6b7280' : '#6b7280'} />
                            </TouchableOpacity>
                          </>
                        )}
                        <TouchableOpacity className="p-1" onPress={() => setEmpresaModal({ visible: true, editing: emp, grupoId: emp.grupo_id, nome_fantasia: emp.nome_fantasia, razao_social: emp.razao_social, cnpj: maskCNPJ(emp.cnpj) })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="create-outline" size={16} color={isDark ? '#6b7280' : '#6b7280'} />
                        </TouchableOpacity>
                        <TouchableOpacity className="p-1" onPress={() => confirmDeleteEmpresa(emp)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity
                      className="flex-row items-center gap-1.5 px-3.5 pt-2.5 pb-1"
                      onPress={() => setEmpresaModal({ ...EMPTY_EMPRESA, visible: true, grupoId: grupo.id })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle-outline" size={17} color="#3b5fe0" />
                      <Text className="text-xs font-medium text-[#3b5fe0] dark:text-indigo-400">Adicionar empresa</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {/* ── Modal Grupo ───────────────────────────────────────────────────── */}
      <Modal visible={grupoModal.visible} transparent animationType="fade" onRequestClose={() => setGrupoModal(EMPTY_GRUPO)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 420 }}>
            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-4">
              {grupoModal.editing ? 'Editar Grupo' : 'Novo Grupo'}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Nome</Text>
            <TextInput
              className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
              style={{ outline: 'none' } as any}
              value={grupoModal.nome}
              onChangeText={(v) => setGrupoModal(p => ({ ...p, nome: v }))}
              placeholder="Ex: Grupo Alfa"
              placeholderTextColor={ph}
              returnKeyType="done"
              onSubmitEditing={saveGrupo}
              autoFocus
            />
            <View className="flex-row gap-2.5 mt-5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setGrupoModal(EMPTY_GRUPO)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center ${(!grupoModal.nome.trim() || saving) ? 'opacity-40' : ''}`}
                onPress={saveGrupo}
                disabled={!grupoModal.nome.trim() || saving}
              >
                <Text className="text-sm font-semibold text-white">Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Empresa ─────────────────────────────────────────────────── */}
      <Modal visible={empresaModal.visible} transparent animationType="fade" onRequestClose={() => setEmpresaModal(EMPTY_EMPRESA)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 420 }}>
            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-4">
              {empresaModal.editing ? 'Editar Empresa' : 'Nova Empresa'}
            </Text>

            {/* Nome Fantasia */}
            <View className="mb-3">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Nome Fantasia</Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={empresaModal.nome_fantasia}
                onChangeText={(v) => setEmpresaModal(p => ({ ...p, nome_fantasia: v }))}
                placeholderTextColor={ph}
                autoFocus
              />
            </View>

            {/* Razão Social */}
            <View className="mb-3">
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Razão Social</Text>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900"
                style={{ outline: 'none' } as any}
                value={empresaModal.razao_social}
                onChangeText={(v) => setEmpresaModal(p => ({ ...p, razao_social: v }))}
                placeholderTextColor={ph}
              />
            </View>

            {/* CNPJ */}
            <View className="mb-3">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-xs text-gray-500 dark:text-gray-400">CNPJ</Text>
                <Text className="text-xs text-gray-400 dark:text-gray-500">{empresaModal.cnpj.replace(/[.\-/]/g, '').length}/14</Text>
              </View>
              <TextInput
                className="h-11 border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                style={{ outline: 'none' } as any}
                value={empresaModal.cnpj}
                onChangeText={(v) => setEmpresaModal(p => ({ ...p, cnpj: maskCNPJ(v) }))}
                placeholder="Ex: 00.000.000/0001-00"
                placeholderTextColor={ph}
                maxLength={18}
                autoCapitalize="characters"
              />
            </View>

            <View className="flex-row gap-2.5 mt-5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setEmpresaModal(EMPTY_EMPRESA)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center ${(!empresaModal.nome_fantasia.trim() || !empresaModal.razao_social.trim() || !validateCNPJ(empresaModal.cnpj) || saving) ? 'opacity-40' : ''}`}
                onPress={saveEmpresa}
                disabled={!empresaModal.nome_fantasia.trim() || !empresaModal.razao_social.trim() || !validateCNPJ(empresaModal.cnpj) || saving}
              >
                <Text className="text-sm font-semibold text-white">Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Módulos ────────────────────────────────────────────────── */}
      <Modal visible={modulosModal.visible} transparent animationType="fade" onRequestClose={() => setModulosModal(EMPTY_MODULOS)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 420 }}>

            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-0.5">Módulos</Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500 mb-4" numberOfLines={1}>
              {modulosModal.empresa?.nome_fantasia}
              {modulosModal.isDefault ? '  ·  padrão (todos habilitados)' : ''}
            </Text>

            <View style={{ gap: 8, marginBottom: 16 }}>
              {MODULOS.map(modulo => {
                const info = MODULOS_INFO[modulo];
                const ativo = modulosModal.modulos.includes(modulo);
                return (
                  <TouchableOpacity
                    key={modulo}
                    onPress={() => toggleModulo(modulo)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                      padding: 14, borderRadius: 12,
                      borderWidth: 1,
                      borderColor: ativo ? '#3b5fe0' : (isDark ? '#374151' : '#e5e7eb'),
                      backgroundColor: ativo ? (isDark ? '#1e3a5f' : '#eff6ff') : (isDark ? '#111827' : '#fff'),
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: ativo ? info.bgColor : (isDark ? '#374151' : '#f3f4f6'),
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={info.icon as any} size={20} color={ativo ? info.color : (isDark ? '#6b7280' : '#9ca3af')} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: ativo ? '#3b5fe0' : (isDark ? '#d1d5db' : '#374151') }}>
                      {info.label}
                    </Text>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                      borderColor: ativo ? '#3b5fe0' : (isDark ? '#4b5563' : '#d1d5db'),
                      backgroundColor: ativo ? '#3b5fe0' : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {ativo && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Restaurar padrão */}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 16 }}
              onPress={() => setModulosModal(p => ({ ...p, modulos: [...MODULOS], isDefault: true }))}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={13} color={isDark ? '#6b7280' : '#9ca3af'} />
              <Text style={{ fontSize: 12, color: isDark ? '#6b7280' : '#9ca3af' }}>Restaurar padrão (todos)</Text>
            </TouchableOpacity>

            <View className="flex-row gap-2.5">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setModulosModal(EMPTY_MODULOS)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center ${saving ? 'opacity-50' : ''}`}
                onPress={saveModulos}
                disabled={saving}
              >
                <Text className="text-sm font-semibold text-white">Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Acessos ────────────────────────────────────────────────── */}
      <Modal visible={acessosModal.visible} transparent animationType="fade" onRequestClose={() => setAcessosModal(EMPTY_ACESSOS)}>
        <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full" style={{ maxWidth: 420, maxHeight: '80%' }}>

            <Text className="text-lg font-bold text-[#1e2d6e] dark:text-white mb-0.5">Acessos</Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500 mb-4" numberOfLines={1}>
              {acessosModal.empresa?.nome_fantasia}
            </Text>

            {loadingAcessos ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text className="text-xs text-gray-400 dark:text-gray-500">Carregando...</Text>
              </View>
            ) : acessosModal.usuarios.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text className="text-xs text-gray-400 dark:text-gray-500">Nenhum usuário disponível</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 8 }}>
                {acessosModal.usuarios.map(u => {
                  const isHome = u.empresa_id === acessosModal.empresa?.id;
                  const cores = PERFIL_COLORS[u.perfil];
                  return (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => !isHome && toggleAcesso(u.id)}
                      disabled={isHome}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        padding: 14, borderRadius: 12,
                        borderWidth: 1,
                        borderColor: u.tem_acesso ? '#3b5fe0' : (isDark ? '#374151' : '#e5e7eb'),
                        backgroundColor: u.tem_acesso ? (isDark ? '#1e3a5f' : '#eff6ff') : (isDark ? '#111827' : '#fff'),
                        opacity: isHome ? 0.7 : 1,
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#d1d5db' : '#374151' }} numberOfLines={1}>
                          {u.nome}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          {cores && (
                            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: isDark ? cores.bgDark : cores.bg }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: cores.text }}>
                                {PERFIL_LABEL[u.perfil] ?? u.perfil}
                              </Text>
                            </View>
                          )}
                          {isHome && (
                            <Text style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af' }}>Empresa de origem</Text>
                          )}
                        </View>
                      </View>
                      <View style={{
                        width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                        borderColor: u.tem_acesso ? '#3b5fe0' : (isDark ? '#4b5563' : '#d1d5db'),
                        backgroundColor: u.tem_acesso ? '#3b5fe0' : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {u.tem_acesso && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View className="flex-row gap-2.5 mt-4">
              <TouchableOpacity
                className="flex-1 h-11 rounded-xl border border-gray-200 dark:border-gray-600 items-center justify-center"
                onPress={() => setAcessosModal(EMPTY_ACESSOS)}
              >
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 h-11 rounded-xl bg-[#3b5fe0] items-center justify-center ${(saving || loadingAcessos) ? 'opacity-50' : ''}`}
                onPress={saveAcessos}
                disabled={saving || loadingAcessos}
              >
                <Text className="text-sm font-semibold text-white">Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Confirmar Exclusão de Grupo ────────────────────────────── */}
      <ConfirmDeleteModal
        visible={!!grupoToDelete}
        message={
          <>
            Você está prestes a remover o grupo{' '}
            <Text className="font-bold text-gray-700 dark:text-gray-200">{grupoToDelete?.nome}</Text>.
          </>
        }
        loading={deleting}
        onCancel={() => setGrupoToDelete(null)}
        onConfirm={handleDeleteGrupo}
      />

      {/* ── Modal Confirmar Exclusão de Empresa ──────────────────────────── */}
      <ConfirmDeleteModal
        visible={!!empresaToDelete}
        message={
          <>
            Você está prestes a remover a empresa{' '}
            <Text className="font-bold text-gray-700 dark:text-gray-200">{empresaToDelete?.nome_fantasia}</Text>.
          </>
        }
        loading={deleting}
        onCancel={() => setEmpresaToDelete(null)}
        onConfirm={handleDeleteEmpresa}
      />

      <LoadingOverlay visible={loading || saving} message={saving ? 'Salvando' : undefined} />
    </View>
  );
}
