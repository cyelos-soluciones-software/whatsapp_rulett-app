# Especificación: Arquitectura del worker

**Repositorio:** whatsapp_rulett-app · **Tipo:** Web Service sin sondeo, en Google Cloud Run (desde 054; antes Render con sondeo)

## Visión

Microservicio **Queue Consumer** que procesa `"WhatsappQueue"` y envía plantillas vía **Meta Graph API v25.0**. No expone API REST de negocio; solo health + trigger interno. Desde 054 solo procesa cuando lo disparan.

## Componentes

| Módulo | Responsabilidad |
|--------|-----------------|
| `src/index.ts` | Orquestador: HTTP server (no programa sondeo) |
| `src/server.ts` | `GET /health`, `POST /api/trigger` (espera el lote; `busy: true` si ya hay uno) |
| `src/processor.ts` | `processBatch()` — claim + envío + mark |
| `src/db/queue.ts` | `pg` + `FOR UPDATE SKIP LOCKED` |
| `src/services/whatsapp.ts` | Meta template + `components` |
| `src/config.ts` | Env validation fail-fast |

## Modo de ejecución

**Trigger HTTP:** rulett-app → `POST /api/trigger` con `Bearer WORKER_API_KEY`. El handler espera `processBatch()` y responde `{ triggered, processed }`. Sin sondeo de 60 s: lo encolado sin disparo espera al siguiente cron o campaña. Antes de reclamar, las filas `PROCESSING` de más de 15 minutos vuelven a `PENDING` (se loguea el conteo). `GET /health` no pide secretos.

Acceso de red: IAM de Cloud Run (token de identidad en `X-Serverless-Authorization`). El worker ya no tiene secreto de borde; `EDGE_SHARED_SECRET` se ignora. El Bearer se compara con `timingSafeEqual` sobre SHA-256.

Render (código anterior, con sondeo) puede convivir con Cloud Run sobre la misma base mientras no se suspenda.

## Escalado horizontal

`claimPendingBatch` con `SKIP LOCKED` — seguro con múltiples réplicas.

## Procesamiento

Secuencial dentro del lote (rate limits Meta).

## Lo que NO hace

- No inserta en cola (rulett-app).
- No calcula variables de plantilla (lee `templateParams`).
- No usa Prisma (SQL directo con `pg`).
