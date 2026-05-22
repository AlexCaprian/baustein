# Baustein — Frontend

Aplicativo móvel e web do projeto Baustein, desenvolvido com Expo (React Native) e Expo Router.

## Tecnologias

- **Expo SDK 55** — plataforma React Native
- **Expo Router** — navegação file-based
- **NativeWind 4** — Tailwind CSS para React Native
- **TypeScript** — tipagem estática
- **React Native Reanimated** — animações fluidas

## Estrutura de pastas

```
src/
├── app/                          # Telas (Expo Router — file-based routing)
│   ├── _layout.tsx               # Layout raiz: ThemeInitializer + AuthGuard + Stack
│   ├── index.tsx                 # Tela de login
│   ├── select-empresa.tsx        # Seleção de empresa (apenas perfil dev)
│   ├── hub.tsx                   # Hub principal pós-login
│   └── funcionarios.tsx          # Gestão de funcionários/usuários
│
├── components/
│   ├── layout/
│   │   └── app-header.tsx        # Header global: logo, tema, avatar, logout
│   └── ui/
│       └── loading-overlay.tsx   # Overlay de carregamento animado
│
├── constants/
│   └── theme.ts                  # Paleta de cores (light/dark), fontes e espaçamentos
│
└── services/
    └── api.ts                    # Cliente HTTP: autenticação, storage e endpoints REST
```

## Fluxo de navegação

```
/                  → index.tsx         (login)
  ↓ perfil dev
/select-empresa    → select-empresa.tsx
  ↓
/hub               → hub.tsx           (dashboard)
  ↓
/funcionarios      → funcionarios.tsx

/hub               ← login direto para admin/funcionario
```

## Perfis de usuário

| Perfil        | Redirect pós-login    | Acesso                                     |
|---------------|-----------------------|--------------------------------------------|
| `dev`         | `/select-empresa`     | Seleciona grupo e empresa manualmente      |
| `admin`       | `/hub`                | Hub da empresa vinculada ao seu cadastro   |
| `funcionario` | `/hub`                | Hub da empresa vinculada ao seu cadastro   |

## Autenticação

O token JWT e os dados do usuário logado (`nome`, `perfil`, `empresa_id`) são salvos no `localStorage` (web) via `src/services/api.ts`. O `AuthGuard` em `_layout.tsx` redireciona para login caso o token não esteja presente em rotas protegidas.

## Como rodar

### Pré-requisitos

- Node.js 18+
- Backend rodando em `http://localhost:8080` (ver `backend/README.md`)

### Instalar dependências

```bash
cd frontend
npm install
```

### Iniciar o servidor de desenvolvimento

```bash
npx expo start
```

Pressione `w` para abrir no browser, `a` para Android ou `i` para iOS.

## Variáveis de ambiente

A URL da API é definida diretamente em `src/services/api.ts`:

```ts
const BASE_URL = 'http://localhost:8080';
```

Altere esse valor conforme o ambiente de deploy.
