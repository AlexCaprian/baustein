import { router } from 'expo-router';
import { Platform } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.18.152:8080';
const TOKEN_KEY = 'operkit_token';
const PERFIL_KEY = 'operkit_perfil';
const NOME_KEY = 'operkit_nome';
const EMPRESA_ID_KEY = 'operkit_empresa_id';
const USER_ID_KEY = 'operkit_user_id';

function readStorage(key: string): string {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key) ?? '';
  }
  return '';
}

function writeStorage(key: string, value: string) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
  }
}

function clearStorage() {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PERFIL_KEY);
    localStorage.removeItem(NOME_KEY);
    localStorage.removeItem(EMPRESA_ID_KEY);
    localStorage.removeItem(USER_ID_KEY);
  }
}

let authToken = readStorage(TOKEN_KEY);
let authPerfil = readStorage(PERFIL_KEY);
let authNome = readStorage(NOME_KEY);
let authEmpresaId = readStorage(EMPRESA_ID_KEY);
let authUserId = readStorage(USER_ID_KEY);

export function setToken(token: string) {
  authToken = token;
  writeStorage(TOKEN_KEY, token);
}

export function getToken() {
  return authToken;
}

export function setPerfil(perfil: string) {
  authPerfil = perfil;
  writeStorage(PERFIL_KEY, perfil);
}

export function getPerfil() {
  return authPerfil;
}

export function setNome(nome: string) {
  authNome = nome;
  writeStorage(NOME_KEY, nome);
}

export function getNome() {
  return authNome;
}

export function setEmpresaId(id: number | null) {
  authEmpresaId = id != null ? String(id) : '';
  writeStorage(EMPRESA_ID_KEY, authEmpresaId);
}

export function getEmpresaId(): number | null {
  const v = authEmpresaId || readStorage(EMPRESA_ID_KEY);
  return v ? Number(v) : null;
}

export function setUserId(id: number | null) {
  authUserId = id != null ? String(id) : '';
  writeStorage(USER_ID_KEY, authUserId);
}

export function getUserId(): number | null {
  const v = authUserId || readStorage(USER_ID_KEY);
  return v ? Number(v) : null;
}

function redirectToLogin() {
  authToken = '';
  clearStorage();
  router.replace('/' as any);
}

export function logout() {
  authToken = '';
  clearStorage();
  router.replace('/' as any);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(BASE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
        ...(options?.headers ?? {}),
      },
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }
  const data = await res.json();
  if (res.status === 401) {
    redirectToLogin();
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) throw new Error(data.error ?? 'Erro na requisição');
  return data as T;
}

// ─── Módulos (enum) ──────────────────────────────────────────────────────────

export const MODULOS = ['funcionarios', 'pontos'] as const;
export type Modulo = typeof MODULOS[number];

export const MODULOS_INFO: Record<Modulo, { label: string; icon: string; color: string; bgColor: string }> = {
  funcionarios: { label: 'Funcionários',      icon: 'people-outline', color: '#3b5fe0', bgColor: '#eef1fd' },
  pontos:       { label: 'Controle de Ponto', icon: 'time-outline',   color: '#d97706', bgColor: '#fef3c7' },
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user_id: number;
  nome: string;
  perfil: string;
  empresa_id: number | null;
  redirect: string;
}

export interface Grupo {
  id: number;
  nome: string;
}

export interface Empresa {
  id: number;
  grupo_id: number;
  grupo?: Grupo;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
}

export interface Usuario {
  id: number;
  empresa_id: number | null;
  nome: string;
  username: string;
  email: string;
  perfil: string;
  hora_trabalha?: number;
}

export interface AcessoUsuario {
  id: number;
  nome: string;
  username: string;
  perfil: string;
  empresa_id: number | null;
  tem_acesso: boolean;
}

export interface UsuarioInput {
  nome: string;
  username: string;
  email: string;
  senha: string;
  perfil: string;
  empresa_id?: number;
  hora_trabalha?: number;
}

export interface PaginatedUsuarios {
  usuarios: Usuario[];
  total: number;
  page: number;
  limit: number;
}

export interface UsuarioListParams {
  empresaId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EmpresaInput {
  grupo_id: number;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
}

export interface HRStat {
  label: string;
  contratacoes: number;
  demissoes: number;
}

export interface Batida {
  entrada: string;
  saida: string;
}

export interface RegistroPonto {
  id: number;
  grupo_id: number;
  empresa_id: number;
  usuario_id: number;
  data: string; // YYYY-MM-DD
  dia_semana: string;
  batidas: Batida[];
  observacao: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const api = {
  login: (username: string, senha: string) =>
    request<LoginResponse>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, senha }),
    }),

  grupos: {
    list: () => request<{ grupos: Grupo[] }>('/api/grupos'),
    create: (nome: string) =>
      request<Grupo>('/api/grupos', { method: 'POST', body: JSON.stringify({ nome }) }),
    update: (id: number, nome: string) =>
      request<Grupo>(`/api/grupos/${id}`, { method: 'PUT', body: JSON.stringify({ nome }) }),
    delete: (id: number) =>
      request<{ message: string }>(`/api/grupos/${id}`, { method: 'DELETE' }),
  },

  usuarios: {
    list: (params?: UsuarioListParams) => {
      const qs = new URLSearchParams();
      if (params?.empresaId != null) qs.set('empresa_id', String(params.empresaId));
      if (params?.search) qs.set('search', params.search);
      if (params?.page) qs.set('page', String(params.page));
      if (params?.limit) qs.set('limit', String(params.limit));
      const query = qs.toString() ? `?${qs}` : '';
      return request<PaginatedUsuarios>(`/api/usuarios${query}`);
    },
    create: (data: UsuarioInput) =>
      request<Usuario>('/api/usuarios', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<UsuarioInput>) =>
      request<Usuario>(`/api/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number, motivo: 'delecao' | 'demissao') =>
      request<{ message: string }>(`/api/usuarios/${id}`, { 
        method: 'DELETE',
        body: JSON.stringify({ motivo })
      }),
    getStats: (empresaId: number) =>
      request<HRStat[]>(`/api/usuarios/stats?empresa_id=${empresaId}`),
    empresas: (id: number) =>
      request<{ empresas: Empresa[] }>(`/api/usuarios/${id}/empresas`),
  },

  ponto: {
    list: (usuarioId: number, from: string, to: string) =>
      request<{ registros: RegistroPonto[] }>(`/api/ponto?usuario_id=${usuarioId}&from=${from}&to=${to}`),
    bulkUpsert: (usuarioId: number, registros: Omit<RegistroPonto, 'id' | 'usuario_id' | 'empresa_id' | 'grupo_id'>[]) =>
      request<{ message: string; count: number }>('/api/ponto/bulk', {
        method: 'POST',
        body: JSON.stringify({ usuario_id: usuarioId, registros }),
      }),
    update: (id: number, data: { batidas?: Batida[]; observacao?: string }) =>
      request<{ message: string }>(`/api/ponto/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ message: string }>(`/api/ponto/${id}`, { method: 'DELETE' }),
  },

  modulos: {
    get: (empresaId: number) =>
      request<{ modulos: string[]; is_default: boolean }>(`/api/empresas/${empresaId}/modulos`),
    set: (empresaId: number, modulos: string[]) =>
      request<{ message: string; count: number }>(`/api/empresas/${empresaId}/modulos`, {
        method: 'PUT',
        body: JSON.stringify({ modulos }),
      }),
  },

  empresas: {
    get: (id: number) => request<Empresa>(`/api/empresas/${id}`),
    list: (grupoId?: number) =>
      request<{ empresas: Empresa[] }>(
        `/api/empresas${grupoId != null ? `?grupo_id=${grupoId}` : ''}`
      ),
    create: (data: EmpresaInput) =>
      request<Empresa>('/api/empresas', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<EmpresaInput>) =>
      request<Empresa>(`/api/empresas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ message: string }>(`/api/empresas/${id}`, { method: 'DELETE' }),
    acessos: {
      get: (id: number) =>
        request<{ usuarios: AcessoUsuario[] }>(`/api/empresas/${id}/acessos`),
      set: (id: number, usuarioIds: number[]) =>
        request<{ message: string }>(`/api/empresas/${id}/acessos`, {
          method: 'PUT',
          body: JSON.stringify({ usuario_ids: usuarioIds }),
        }),
    },
  },
};
