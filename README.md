# Operkit

Sistema ERP modular multi-empresa com frontend React Native (Expo) e backend Go.

## Visão Geral

O Operkit é uma plataforma ERP que suporta múltiplos grupos e empresas, com autenticação JWT e uma interface multiplataforma (iOS, Android e Web).

## Estrutura do Projeto

```
operkit/
├── backend/          # API REST em Go
├── frontend/         # App React Native com Expo
├── exemple/          # Mockups de referência de UI
└── docker-compose.yml
```

## Stack

| Camada     | Tecnologia                                        |
|------------|---------------------------------------------------|
| Frontend   | React Native 0.83, Expo 55, TypeScript, NativeWind |
| Backend    | Go 1.23, Gin, GORM                                |
| Banco      | PostgreSQL 15                                     |
| Storage    | MinIO (S3-compatible)                             |
| Auth       | JWT (HS256, 24h)                                  |

## Pré-requisitos

- [Go 1.23+](https://go.dev/)
- [Node.js 18+](https://nodejs.org/)
- [Docker](https://www.docker.com/) e Docker Compose

## Rodando Localmente

### 1. Serviços (banco + storage)

```bash
docker compose up -d
```

Isso sobe:
- **PostgreSQL** na porta `5432` (usuário: `operkit`, senha: `password`, banco: `operkit_dev`)
- **MinIO** na porta `9000` (console em `9001`, usuário: `admin`, senha: `password123`)

### 2. Backend

```bash
cd backend
go run .
```

A API ficará disponível em `http://localhost:8080`.

Variáveis de ambiente opcionais (via `.env`):

| Variável      | Padrão                      | Descrição                  |
|---------------|-----------------------------|----------------------------|
| `JWT_SECRET`  | `REDACTED`  | Chave de assinatura JWT    |
| `DB_DSN`      | —                           | DSN de conexão PostgreSQL  |

### 3. Frontend

```bash
cd frontend
npm install
npx expo start
```

Abra no:
- **iOS**: `i` no terminal ou app Expo Go
- **Android**: `a` no terminal ou app Expo Go
- **Web**: `w` no terminal

## API

### Autenticação

```
POST /api/login
Body: { "username": "...", "senha": "..." }
```

Retorna um token JWT a ser enviado no header `Authorization: Bearer <token>`.

### Endpoints protegidos

| Método | Rota                  | Descrição                        |
|--------|-----------------------|----------------------------------|
| GET    | `/api/modules`        | Módulos disponíveis              |
| GET    | `/api/grupos`         | Listar grupos                    |
| POST   | `/api/grupos`         | Criar grupo                      |
| PUT    | `/api/grupos/:id`     | Atualizar grupo                  |
| DELETE | `/api/grupos/:id`     | Remover grupo                    |
| GET    | `/api/empresas`       | Listar empresas (filtro: `grupo_id`) |
| POST   | `/api/empresas`       | Criar empresa                    |
| PUT    | `/api/empresas/:id`   | Atualizar empresa                |
| DELETE | `/api/empresas/:id`   | Remover empresa                  |
| GET    | `/api/usuarios`       | Listar usuários                  |
| POST   | `/api/usuarios`       | Criar usuário                    |
| PUT    | `/api/usuarios/:id`   | Atualizar usuário                |
| DELETE | `/api/usuarios/:id`   | Remover usuário                  |

### Health check

```
GET /ping  →  "pong"
```

## Modelos

**Grupo** — agrupamento de empresas  
**Empresa** — NomeFantasia, RazaoSocial, CNPJ, vinculada a um Grupo  
**Usuario** — perfis: `admin`, `funcionario`, `dev`; vinculado a uma Empresa

## Fluxo de Autenticação

1. Login → recebe JWT + redirecionamento baseado no perfil
2. Se o usuário tem acesso a múltiplas empresas → tela `select-empresa`
3. Token armazenado no `localStorage` (web) ou memória (mobile)

## Licença

MIT © 2026 Alex Silva
