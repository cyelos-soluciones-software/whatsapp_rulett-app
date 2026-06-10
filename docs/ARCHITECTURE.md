# Arquitectura

> **Fuente canónica:** [../openspec/specs/system_architecture.md](../openspec/specs/system_architecture.md) y [integrations.md](../openspec/specs/integrations.md). Este archivo se mantiene como referencia extendida.

## Visión general

El worker implementa el patrón **Queue Consumer** con polling periódico **y** disparo HTTP bajo demanda. Se despliega como **Web Service** en Render (puerto HTTP requerido para `/api/trigger`).

La app Rulett encola mensajes y puede invocar el worker vía:
- Botón **Enviar pendientes ahora** en `/admin/whatsapp`
- Cron Vercel `GET /api/cron/send-whatsapp` → `POST` al worker

## Componentes

### `src/index.ts` — Orquestador

- Arranca servidor HTTP (`server.ts`) y bucle de polling.
- Bucle: `processBatch()` → `sleep(POLL_INTERVAL_MS)`.
- Señales `SIGTERM` / `SIGINT` para apagado graceful.
- Logging estructurado JSON.

### `src/processor.ts` — Procesamiento de cola

- `processBatch()`: reclama lote, envía a Meta, marca `SENT` / `FAILED`.
- Reutilizado por polling y por `/api/trigger`.

### `src/server.ts` — HTTP mínimo

- `GET /health` — health check (Render).
- `GET|POST /api/trigger` — procesa un lote inmediato si `Authorization: Bearer WORKER_API_KEY` es válido.
- Servidor HTTP nativo de Node (sin Express).

### `src/config.ts` — Configuración

- Carga variables con `dotenv`.
- Valida requeridas al inicio (fail-fast), incl. `WORKER_API_KEY` en producción.
- SSL automático según host de `DATABASE_URL`.

### `src/db/queue.ts` — QueueRepository

- Pool `pg` (max 10 conexiones).
- `claimPendingBatch(limit)`: `FOR UPDATE SKIP LOCKED`.
- `markSent(id)` / `markFailed(id, errorLog)`.

### `src/services/whatsapp.ts` — WhatsappClient

- Meta Graph API v25.0, mensajes `template`.
- Retorna `WhatsappSendResult` sin lanzar por errores HTTP.

## Diagrama de secuencia (polling o trigger)

```
Worker/HTTP            QueueRepository           PostgreSQL          WhatsappClient          Meta API
  │                          │                        │                      │                    │
  │── claimPendingBatch() ──▶│                        │                      │                    │
  │                          │── UPDATE SKIP LOCKED ─▶│                      │                    │
  │◀── WhatsappQueueRow[] ──│                        │                      │                    │
  │── sendTemplateMessage() ──────────────────────────────────────────────▶│                    │
  │                          │                        │                      │── POST /messages ─▶│
  │── markSent/markFailed() ▶│── UPDATE status ──────▶│                      │                    │
```

## Diagrama: trigger desde rulett-app

```
Tenant Admin / Vercel cron
        │
        ▼
  rulett-app (whatsapp-worker-trigger.ts)
        │ POST /api/trigger + Bearer WORKER_API_KEY
        ▼
  whatsapp_rulett-app (server.ts → processor.ts)
        │
        ▼
  WhatsappQueue → Meta Graph API
```

## Decisiones de diseño

### ¿Por qué `pg` y no Prisma?

- Solo 3 queries SQL optimizadas; `FOR UPDATE SKIP LOCKED` en SQL crudo.
- Microservicio independiente sin cliente Prisma.

### ¿Por qué polling + trigger?

- Polling: resiliencia sin depender de Vercel cron.
- Trigger: latencia baja tras encolar desde admin o cron Pro.

### ¿Por qué `FOR UPDATE SKIP LOCKED`?

- Escalado horizontal seguro (N réplicas).

### ¿Por qué HTTP mínimo y no API REST?

- Render Background Worker no expone puerto; Rulett necesita disparar envío.
- Solo `/api/trigger` y `/health` — no CRUD ni endpoints públicos.

## Integración con límites mensuales (rulett-app)

El cupo `Tenant.maxWhatsappPerMonth` se valida en **rulett-app** al encolar (`queueWhatsappMessages`). Este worker no consulta el límite; procesa registros `PENDING` existentes.

Conteo mensual en Rulett: `status = SENT` y `sentAt >= inicio del mes` (zona Colombia).

## Plantillas Meta y `templateParams`

Rulett pre-calcula el JSON al encolar (`queueWhatsappMessages` + `whatsapp-template-params.ts`). El worker:

1. Lee `templateName` + `templateParams` del row reclamado.
2. Construye `template.components` (header + body) con `parameter_name`.
3. `POST https://graph.facebook.com/v25.0/{phoneId}/messages` con `Authorization: Bearer WHATSAPP_TOKEN`.

Si `templateParams` es null → `FAILED` con mensaje explícito en `errorLog` (no llamar a Meta sin variables).
