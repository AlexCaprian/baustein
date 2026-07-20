# Operkit — Frontend

App multiplataforma (iOS, Android e Web) do Operkit, um ERP modular multi-empresa, construído com React Native e Expo Router.

Este repositório contém **apenas o frontend**. A API roda em um repositório separado ([baustein-api](https://github.com/AlexCaprian/baustein-api), em Go).

## Stack

| Camada       | Tecnologia                                  |
|--------------|----------------------------------------------|
| Framework    | React Native 0.83, Expo 55, Expo Router 55   |
| Linguagem    | TypeScript                                   |
| Estilo       | NativeWind (Tailwind para React Native)      |
| Navegação    | React Navigation                             |
| Auth         | JWT, com sessão persistida no `localStorage` (web) |

## Pré-requisitos

- [Node.js 18+](https://nodejs.org/)
- Uma instância da API rodando (local ou remota) — veja [baustein-api](https://github.com/AlexCaprian/baustein-api)

## Rodando localmente

```bash
npm install
npx expo start
```

Abra no:
- **iOS**: `i` no terminal ou app Expo Go
- **Android**: `a` no terminal ou app Expo Go
- **Web**: `w` no terminal

## Variáveis de ambiente

Crie um `.env.local` na raiz do projeto:

| Variável                      | Padrão                   | Descrição                                                                 |
|-------------------------------|---------------------------|----------------------------------------------------------------------------|
| `EXPO_PUBLIC_API_URL`         | `http://localhost:8080`  | URL base da API (Railway, ngrok ou local)                                 |
| `EXPO_PUBLIC_ID_HASH_SECRET`  | —                         | Secret usado para ofuscar IDs (empresa, grupo) nos parâmetros de rota/URL |

## Estrutura do projeto

```
frontend/
├── src/
│   ├── app/                 # Telas (Expo Router)
│   │   ├── index.tsx        # Login
│   │   ├── select-empresa.tsx
│   │   ├── hub.tsx          # Hub de módulos
│   │   ├── funcionarios.tsx
│   │   ├── ponto.tsx        # Controle de ponto
│   │   ├── financeiro.tsx
│   │   └── estoque.tsx
│   ├── components/
│   │   ├── layout/          # app-header, module-header
│   │   └── ui/              # confirm-delete-modal, loading-overlay, app-splash-screen
│   ├── services/
│   │   ├── api.ts           # Client HTTP + sessão/autenticação
│   │   ├── idHash.ts        # Ofuscação de IDs nas rotas
│   │   ├── estoqueMock.ts   # Dados mock do módulo Estoque
│   │   └── financeiroMock.ts# Dados mock do módulo Financeiro
│   └── constants/
└── assets/
```

## Módulos

- **Login / Seleção de empresa** — autenticação e, quando o usuário tem acesso a múltiplas empresas, seleção de qual empresa acessar
- **Hub** — ponto de entrada para os módulos disponíveis ao perfil do usuário
- **Funcionários** — cadastro e gestão de usuários/funcionários
- **Ponto** — controle de ponto
- **Financeiro** — módulo financeiro (em desenvolvimento, dados mockados)
- **Estoque** — módulo de estoque (em desenvolvimento, dados mockados)

## Perfis de usuário

`admin`, `funcionario`, `dev` e `master` — cada um com acesso a um subconjunto de módulos e empresas/grupos.

## Licença

MIT © 2026 Alex Silva
