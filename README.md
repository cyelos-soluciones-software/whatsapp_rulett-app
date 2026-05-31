# whatsapp-rulett-worker

Worker en **Node.js + TypeScript** que consume la cola `"WhatsappQueue"` en PostgreSQL (Neon) y envía mensajes de WhatsApp vía **Meta Graph API**.

Parte del ecosistema **Rulett**: la aplicación principal inserta mensajes `PENDING`; este servicio los procesa y envía.

## Quick start

```bash
# 1. Clonar e instalar
git clone <repo-url>
cd whatsapp_rulett.app
npm install

# 2. Configurar entorno
cp .env.example .env
# Editar .env con DATABASE_URL, WHATSAPP_TOKEN, etc.

# 3. Aplicar schema del worker (si es primera vez)
npm run db:schema

# 4. Desarrollo
npm run dev

# 5. Producción
npm run build
npm start
```

## Variables de entorno

Copia `.env.example` a `.env` y configura:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión PostgreSQL (Neon o local) |
| `POLL_INTERVAL_MS` | Intervalo de polling en ms (ej. `60000`) |
| `WHATSAPP_TOKEN` | Bearer token de Meta |
| `WHATSAPP_PHONE_ID` | ID del número de WhatsApp Business |
| `WHATSAPP_ACCOUNT_ID` | ID de la cuenta Meta Business |
| `BATCH_SIZE` | Mensajes por lote (default: `50`) |
| `WHATSAPP_LANGUAGE_CODE` | Idioma default de templates (default: `es_CO`) |
| `DATABASE_SSL` | `true` en Neon, `false` en localhost |

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo con hot-reload |
| `npm run build` | Compilar TypeScript |
| `npm start` | Ejecutar worker compilado |
| `npm run typecheck` | Verificar tipos |
| `npm run db:up` | Levantar PostgreSQL (Docker) |
| `npm run db:down` | Detener PostgreSQL |
| `npm run db:setup` | Docker + schema + seed |
| `npm run db:schema` | Aplicar migraciones del worker |
| `npm run db:seed` | Insertar registros de prueba |
| `npm run db:inspect` | Inspeccionar BD |

## Arquitectura

```
┌─────────────┐     INSERT PENDING     ┌──────────────────┐
│  App Rulett │ ─────────────────────▶ │  WhatsappQueue   │
│  (Prisma)   │                        │  (PostgreSQL)    │
└─────────────┘                        └────────┬─────────┘
                                                │ polling
                                                ▼
                                       ┌──────────────────┐
                                       │  Este Worker     │
                                       │  (Node.js/TS)    │
                                       └────────┬─────────┘
                                                │ POST
                                                ▼
                                       ┌──────────────────┐
                                       │  Meta Graph API  │
                                       │  WhatsApp v25.0  │
                                       └──────────────────┘
```

## Documentación

| Documento | Para quién |
|---|---|
| [**AGENTS.md**](AGENTS.md) | Agentes de IA (Cursor, Antigravity) — **leer primero** |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Diseño del sistema |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema y estados de la cola |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Desarrollo local |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Render, Railway, Docker |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Estándares de código |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guía de contribución |

## Docker

```bash
# PostgreSQL local en puerto 5440
npm run db:setup

# Worker containerizado
docker build -t whatsapp-worker .
docker run --env-file .env whatsapp-worker
```

## Licencia

MIT
