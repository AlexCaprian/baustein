import { router } from 'expo-router';
import { Platform } from 'react-native';

const BASE_URL = 'http://localhost:8080';
const TOKEN_KEY = 'baustein_token';
const PERFIL_KEY = 'baustein_perfil';
const NOME_KEY = 'baustein_nome';
const EMPRESA_ID_KEY = 'baustein_empresa_id';

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
  }
}

let authToken = readStorage(TOKEN_KEY);
let authPerfil = readStorage(PERFIL_KEY);
let authNome = readStorage(NOME_KEY);
let authEmpresaId = readStorage(EMPRESA_ID_KEY);

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
}

export interface UsuarioInput {
  nome: string;
  username: string;
  email: string;
  senha: string;
  perfil: string;
  empresa_id?: number;
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
    delete: (id: number) =>
      request<{ message: string }>(`/api/usuarios/${id}`, { method: 'DELETE' }),
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
  },
};
