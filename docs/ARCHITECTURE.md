# Arquitectura

## Visión general

El worker implementa el patrón **Queue Consumer** con polling periódico. No expone endpoints HTTP; es un proceso de larga duración diseñado para desplegarse como **Background Worker** en Render o Railway.

## Componentes

### `src/index.ts` — Orquestador

- Punto de entrada del proceso.
- Bucle principal: `processBatch()` → `sleep(POLL_INTERVAL_MS)`.
- Manejo de señales `SIGTERM` / `SIGINT` para apagado graceful.
- Logging estructurado en JSON.

### `src/config.ts` — Configuración

- Carga variables de entorno con `dotenv`.
- Valida presencia de variables requeridas al inicio (fail-fast).
- Detecta automáticamente si SSL es necesario según el host de `DATABASE_URL`.

### `src/db/queue.ts` — QueueRepository

- Pool de conexiones `pg` (max 10 conexiones).
- `claimPendingBatch(limit)`: reclama registros con bloqueo optimista.
- `markSent(id)`: actualiza a `SENT` con timestamp.
- `markFailed(id, errorLog)`: actualiza a `FAILED` con motivo.

### `src/services/whatsapp.ts` — WhatsappClient

- Cliente HTTP para Meta Graph API v25.0.
- Envía mensajes de tipo `template`.
- Retorna resultado tipado (`WhatsappSendResult`) sin lanzar excepciones por errores HTTP.

### `src/types.ts` — Tipos

- `WhatsappQueueRow`: representa una fila de la cola.
- `QueueStatus`: union type de estados válidos.
- `WhatsappSendResult`: resultado del envío a Meta.

## Diagrama de secuencia

```
Worker                  QueueRepository           PostgreSQL          WhatsappClient          Meta API
  │                          │                        │                      │                    │
  │── claimPendingBatch() ──▶│                        │                      │                    │
  │                          │── BEGIN ──────────────▶│                      │                    │
  │                          │── UPDATE SKIP LOCKED ─▶│                      │                    │
  │                          │◀── RETURNING rows ────│                      │                    │
  │                          │── COMMIT ─────────────▶│                      │                    │
  │◀── WhatsappQueueRow[] ──│                        │                      │                    │
  │                          │                        │                      │                    │
  │── sendTemplateMessage() ──────────────────────────────────────────────▶│                    │
  │                          │                        │                      │── POST /messages ─▶│
  │                          │                        │                      │◀── 200 / 4xx ─────│
  │◀── WhatsappSendResult ─────────────────────────────────────────────────│                    │
  │                          │                        │                      │                    │
  │── markSent/markFailed() ▶│                        │                      │                    │
  │                          │── UPDATE status ──────▶│                      │                    │
  │                          │                        │                      │                    │
  │── sleep(POLL_INTERVAL) ──│                        │                      │                    │
```

## Decisiones de diseño

### ¿Por qué `pg` y no Prisma?

- El worker solo necesita 3 queries SQL optimizadas.
- `FOR UPDATE SKIP LOCKED` es más natural en SQL crudo.
- Evita dependencia pesada y generación de cliente Prisma en un microservicio independiente.

### ¿Por qué polling y no LISTEN/NOTIFY?

- Simplicidad operacional: funciona igual en Neon, Render y Railway.
- Resiliente a desconexiones: el próximo ciclo retoma automáticamente.
- Trade-off: latencia = `POLL_INTERVAL_MS` (aceptable para notificaciones de cupones).

### ¿Por qué `FOR UPDATE SKIP LOCKED`?

- Permite escalar horizontalmente (N réplicas del worker).
- Cada réplica reclama filas distintas sin bloquearse mutuamente.
- Alternativa descartada: `SELECT + UPDATE` separados (race condition con múltiples workers).

### ¿Por qué procesamiento secuencial?

- Meta impone rate limits por número de teléfono.
- Simplifica trazabilidad de errores por mensaje.
- Extensible: se puede agregar un rate limiter + concurrencia controlada después.

### ¿Por qué logs JSON?

- Compatible con agregadores de logs en cloud (Render, Railway, Datadog).
- Facilita filtrado por `queueId`, `level`, `tenantId`.

## Límites y consideraciones

| Aspecto | Estado actual | Mejora futura |
|---|---|---|
| Rate limiting Meta | No implementado | Token bucket / retry-after |
| Reintentos | No (FAILED permanece) | Job de retry con max attempts |
| Dead letter queue | No | Tabla o status `DEAD` |
| Idempotencia Meta | Parcial (via claim) | Message dedup key |
| Observabilidad | Solo stdout JSON | Métricas Prometheus |
| Templates dinámicos | Solo nombre + idioma | Soporte `components` |

## Dependencias externas

```
┌─────────────────────────────────────────────────┐
│                    Worker                        │
│  ┌─────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  dotenv  │  │     pg       │  │ fetch (native)│
│  └─────────┘  └──────┬───────┘  └──────┬─────┘ │
└───────────────────────┼─────────────────┼────────┘
                        │                 │
                        ▼                 ▼
                 ┌────────────┐   ┌──────────────┐
                 │ PostgreSQL │   │ Meta Graph   │
                 │   (Neon)   │   │ API v25.0    │
                 └────────────┘   └──────────────┘
```
