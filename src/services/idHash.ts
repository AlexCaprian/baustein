import Hashids from 'hashids';

const SECRET = process.env.EXPO_PUBLIC_ID_HASH_SECRET || '';

if (!SECRET && __DEV__) {
  console.warn('EXPO_PUBLIC_ID_HASH_SECRET não definido — defina em .env.local para ofuscar IDs na URL.');
}

const hashids = new Hashids(SECRET, 8);

/** Codifica um ID numérico para uso em parâmetros de rota/URL. */
export function encodeId(id: number | null | undefined): string {
  if (id === null || id === undefined) return '';
  return hashids.encode(id);
}

/** Decodifica um ID vindo de parâmetros de rota/URL. Retorna 0 se inválido. */
export function decodeId(hash: string | string[] | undefined): number {
  if (!hash || Array.isArray(hash)) return 0;
  const [id] = hashids.decode(hash);
  return typeof id === 'number' ? id : 0;
}
