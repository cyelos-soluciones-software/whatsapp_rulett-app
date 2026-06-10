# Especificación: Arquitectura del worker

**Repositorio:** whatsapp_rulett-app · **Tipo:** Web Service + background polling (Render)

## Visión

Microservicio **Queue Consumer** que procesa `"WhatsappQueue"` y envía plantillas vía **Meta Graph API v25.0**. No expone API REST de negocio; solo health + trigger interno.

## Componentes

| Módulo | Responsabilidad |
|--------|-----------------|
| `src/index.ts` | Orquestador: HTTP server + bucle polling |
| `src/server.ts` | `GET /health`, `POST /api/trigger` |
| `src/processor.ts` | `processBatch()` — claim + envío + mark |
| `src/db/queue.ts` | `pg` + `FOR UPDATE SKIP LOCKED` |
| `src/services/whatsapp.ts` | Meta template + `components` |
| `src/config.ts` | Env validation fail-fast |

## Modos de ejecución

1. **Polling:** `while` + `sleep(POLL_INTERVAL_MS)` — sin solapamiento.
2. **Trigger HTTP:** rulett-app → `POST /api/trigger` con `Bearer WORKER_API_KEY`.

Ambos usan `processBatch()`.

## Escalado horizontal

`claimPendingBatch` con `SKIP LOCKED` — seguro con múltiples réplicas.

## Procesamiento

Secuencial dentro del lote (rate limits Meta).

## Lo que NO hace

- No inserta en cola (rulett-app).
- No calcula variables de plantilla (lee `templateParams`).
- No usa Prisma (SQL directo con `pg`).
