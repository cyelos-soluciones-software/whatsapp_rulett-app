# AGENTS.md — Guía para agentes de IA

> **Propósito:** Este archivo es la fuente de verdad para Cursor, Antigravity y cualquier agente de codificación que retome el proyecto. Léelo completo antes de modificar código.

## Resumen ejecutivo

**whatsapp-rulett-worker** es un microservicio **Worker** (no expone HTTP) escrito en **TypeScript + Node.js LTS**. Su única responsabilidad:

1. Hacer polling de la tabla PostgreSQL `"WhatsappQueue"`.
2. Enviar mensajes de plantilla vía **Meta WhatsApp Cloud API** (Graph API v25.0).
3. Actualizar el estado de cada registro (`PENDING` → `PROCESSING` → `SENT` | `FAILED`).

El worker **no inserta** mensajes en la cola. Eso lo hace la aplicación principal (Rulett) vía Prisma. Este repo solo **consume** la cola.

## Contexto del ecosistema

| Componente | Rol | Repositorio |
|---|---|---|
| App principal Rulett | Crea registros `PENDING` en `WhatsappQueue` | *(externo, Prisma)* |
| **Este worker** | Procesa la cola y envía WhatsApp | Este repo |
| Neon PostgreSQL | Base de datos compartida | Cloud |
| Meta Graph API | Envío de mensajes WhatsApp | Externo |

## Estructura del repositorio

```
src/
  index.ts              # Entry point: bucle de polling + graceful shutdown
  config.ts             # Carga y valida variables de entorno
  types.ts              # Tipos TypeScript compartidos
  db/queue.ts           # QueueRepository (pg): claim, markSent, markFailed
  services/whatsapp.ts  # WhatsappClient: POST a Graph API
scripts/
  seed.ts               # Inserta registros PENDING de prueba
  apply-schema.ts       # Aplica sql/schema.sql
  apply-sql.ts          # Ejecuta cualquier archivo SQL
  inspect-db.ts         # Inspecciona tablas y datos de muestra
sql/
  schema.sql            # Migración idempotente de columnas del worker
  dev-bootstrap.sql     # Tenant/campaña demo para Docker aislado
  seed.sql              # Seed estático para Docker init
docs/                   # Documentación extendida (ver índice abajo)
```

## Flujo de datos (obligatorio entender)

```
[PENDING] ──claimPendingBatch()──▶ [PROCESSING]
                                        │
                         sendTemplateMessage()
                                        │
                          ┌─────────────┴─────────────┐
                          ▼                           ▼
                       [SENT]                      [FAILED]
                    (+ sentAt)                  (+ errorLog)
```

- **Escalado horizontal:** `claimPendingBatch` usa `FOR UPDATE SKIP LOCKED` — seguro con múltiples réplicas.
- **Procesamiento secuencial:** Los mensajes del lote se envían uno a uno (no en paralelo).
- **Bucle:** `while` + `sleep(POLL_INTERVAL_MS)` — no usa `setInterval` para evitar solapamiento.

## Variables de entorno requeridas

| Variable | Requerida | Default | Notas |
|---|---|---|---|
| `DATABASE_URL` | Sí | — | Neon o PostgreSQL local |
| `POLL_INTERVAL_MS` | Sí | `60000` | Intervalo entre ciclos |
| `WHATSAPP_TOKEN` | Sí | — | Bearer token Meta |
| `WHATSAPP_PHONE_ID` | Sí | — | ID del número WhatsApp |
| `WHATSAPP_ACCOUNT_ID` | Sí | — | ID cuenta Meta (logging) |
| `BATCH_SIZE` | No | `50` | Registros por lote |
| `WHATSAPP_LANGUAGE_CODE` | No | `es_CO` | Fallback si fila no tiene `languageCode` |
| `DATABASE_SSL` | No | auto | `false` en localhost, `true` en Neon |

Ver `.env.example`. **Nunca commitear `.env`.**

## Base de datos — reglas críticas

- Tabla: `"WhatsappQueue"` (comillas dobles, camelCase — convención **Prisma**).
- Status como `TEXT`: `PENDING`, `PROCESSING`, `SENT`, `FAILED`.
- FKs existentes: `tenantId` → `Tenant`, `qrCampaignId` → `QrCampaign`.
- Columnas añadidas por el worker: `languageCode`, `errorLog`, `sentAt`.
- **No renombrar columnas** sin coordinar con el schema Prisma de la app principal.
- Detalle completo: [`docs/DATABASE.md`](docs/DATABASE.md)

## Comandos esenciales

```bash
npm install          # Instalar dependencias
npm run build        # Compilar TypeScript → dist/
npm start            # Producción (dist/index.js)
npm run dev          # Desarrollo con hot-reload (tsx)
npm run typecheck    # Verificar tipos sin compilar

npm run db:schema    # Aplicar migraciones del worker
npm run db:seed      # Insertar registros PENDING de prueba
npm run db:inspect   # Ver tenants, campañas y cola
npm run db:setup     # Docker up + schema + seed
```

## Reglas para agentes de IA al modificar código

### Hacer

- Usar **TypeScript estricto** (`strict: true` en tsconfig).
- Usar **`pg`** para acceso a BD (no agregar Prisma aquí).
- Usar **`fetch` nativo** de Node.js para llamadas HTTP (no axios).
- Importar con extensión `.js` en imports relativos (`./config.js`) — requerido por `module: NodeNext`.
- Mantener logs en **JSON estructurado** (`console.log(JSON.stringify(...))`).
- Mantener cambios **mínimos y enfocados** — este es un worker simple.
- Ejecutar `npm run build` tras cambios en `src/`.
- Respetar el patrón `FOR UPDATE SKIP LOCKED` para cualquier cambio en claim de cola.

### No hacer

- No convertir esto en un servidor HTTP/API REST.
- No agregar ORM (Prisma) — el worker usa SQL directo con `pg`.
- No commitear `.env`, tokens ni credenciales.
- No cambiar nombres de tabla/columna sin actualizar `docs/DATABASE.md` y coordinar con Prisma.
- No procesar mensajes en paralelo sin revisar rate limits de Meta API.
- No crear commits ni PRs a menos que el usuario lo pida explícitamente.

## Stack tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | ≥ 20 LTS | Runtime |
| TypeScript | 5.x | Lenguaje |
| pg | 8.x | Cliente PostgreSQL |
| dotenv | 16.x | Variables de entorno |
| tsx | dev | Hot-reload en desarrollo |

## Despliegue

- **Render:** Background Worker — Build: `npm install && npm run build`, Start: `npm start`
- **Railway:** Mismo comando de start, variables de entorno en dashboard
- **Docker:** `Dockerfile` multi-stage incluido

Detalle: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## Documentación extendida

| Documento | Contenido |
|---|---|
| [`README.md`](README.md) | Overview humano + quick start |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Diseño, componentes, diagramas |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema, estados, FKs, migraciones |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Setup local, scripts, debugging |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Render, Railway, Docker |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Estándares de código TypeScript |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Flujo de contribución |

## Estado actual del proyecto

- Worker funcional con polling, claim optimista y envío a Meta Graph API v25.0.
- Compatible con schema Prisma existente (`Tenant`, `QrCampaign`, `WhatsappQueue`).
- Docker Compose para PostgreSQL local en puerto 5440.
- Scripts de seed, schema e inspección de BD.
- Sin tests automatizados aún.
- Sin health check HTTP (es un worker puro, no un web service).

## Puntos de extensión futuros (no implementados)

- Reintentos automáticos para `FAILED` (con backoff).
- Procesamiento paralelo controlado (con rate limiter).
- Métricas / observabilidad (Prometheus, Datadog).
- Soporte para templates con parámetros dinámicos (`components`).
- Health check endpoint opcional para plataformas que lo requieran.
