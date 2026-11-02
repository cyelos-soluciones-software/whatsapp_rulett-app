# AGENTS.md — Guía para agentes de IA

> **Propósito:** reglas de implementación del worker. `CLAUDE.md` y `.cursor/rules/` apuntan aquí.

## Dónde está la memoria (leer primero)

**Toda la memoria técnica del worker vive en [`openspec/`](./openspec/README.md).** No hay otra: `docs/` y `docs/sdd/` ya no existen (se consolidaron en `openspec/` el 2026-10-20).

| Necesito… | Leo |
|---|---|
| Mapa, flujo SDD y convenciones | [openspec/README.md](./openspec/README.md) (las reglas completas del flujo están en `../rulett-app/openspec/README.md`) |
| Qué está en curso y último cierre | [openspec/changes/active/README.md](./openspec/changes/active/README.md) — **único lugar del estado** |
| Estado actual del worker | [openspec/specs/](./openspec/specs/) — `system_architecture.md` y `domain_model.md` (contrato `WhatsappQueue` / `templateParams`) |
| El SDD de la feature en curso | `openspec/changes/active/NNN-slug/` — léelo completo **antes** de codificar |
| Despliegue, BD, desarrollo local, convenciones | [openspec/runbooks/](./openspec/runbooks/) |
| La app que encola | `../rulett-app/openspec/` — **el número de un cambio compartido lo asigna rulett-app** |

## Resumen ejecutivo

**whatsapp-rulett-worker** es un microservicio **TypeScript + Node.js LTS** que combina:

1. **Polling** de la tabla PostgreSQL `"WhatsappQueue"`.
2. **HTTP mínimo** para disparo bajo demanda (`GET/POST /api/trigger`, `GET /health`).
3. Envío de plantillas vía **Meta WhatsApp Cloud API** (Graph API v25.0).
4. Actualización de estado (`PENDING` → `PROCESSING` → `SENT` | `FAILED`).

**No es una API REST general** — solo endpoints de control del worker. La app Rulett **inserta** en cola y **dispara** el trigger con `WORKER_API_KEY`.

## Contexto del ecosistema

| Componente | Rol | Repositorio |
|---|---|---|
| App principal Rulett | Encola `PENDING` + `POST` trigger (`WORKER_API_KEY`) | `rulett-app` |
| **Este worker** | Polling + procesa bajo demanda + envía WhatsApp | Este repo |
| Neon PostgreSQL | Base de datos compartida | Cloud |
| Meta Graph API | Envío de mensajes WhatsApp | Externo |

## Estructura del repositorio

```
src/
  index.ts              # Entry: polling + arranca servidor HTTP
  processor.ts          # processBatch(): claim + envío Meta
  server.ts             # HTTP nativo: /api/trigger, /health
  config.ts             # Env: DATABASE_URL, WORKER_API_KEY, PORT, Meta
  types.ts              # Tipos compartidos
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
openspec/               # Memoria: specs, cambios y runbooks (ver índice abajo)
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
| `WHATSAPP_V2_BUTTON_INDEX` | No | `1` | Índice base 0 del botón «Información del comercio» en las plantillas v2 (056). Debe coincidir con el orden aprobado en Meta. Un valor que no sea entero ≥ 0 hace fallar el arranque |
| `WHATSAPP_V2_BUTTON_PARAM_NAME` | No | sin definir | Si se define (p. ej. `boton_comercio`), el parámetro del botón v2 viaja con ese `parameter_name`; sin definir, va posicional. Cambiarla en Cloud Run crea una revisión nueva sin rebuild |
| `WHATSAPP_FEEDBACK_BUTTON_INDEX` | No | `0` | 068: índice base 0 del botón «Calificar» de `calificar_pedido`. Un valor que no sea entero ≥ 0 hace fallar el arranque |
| `WHATSAPP_FEEDBACK_BUTTON_PARAM_NAME` | No | sin definir | 068: `parameter_name` del botón de calificación; sin definir, va posicional |
| `WHATSAPP_LANGUAGE_CODE` | No | `es_CO` | Fallback si fila no tiene `languageCode` |
| `WORKER_API_KEY` | Sí (prod) | — | Bearer para `/api/trigger` (mismo valor en Vercel) |
| `PORT` | No | `8080` | Puerto HTTP (Render lo inyecta) |
| `DATABASE_SSL` | No | auto | `false` en localhost, `true` en Neon |

Ver `.env.example`. **Nunca commitear `.env`.**

## Base de datos — reglas críticas

- Tabla: `"WhatsappQueue"` (comillas dobles, camelCase — convención **Prisma**).
- Status como `TEXT`: `PENDING`, `PROCESSING`, `SENT`, `FAILED`.
- FKs existentes: `tenantId` → `Tenant`, `qrCampaignId` → `QrCampaign`.
- Columnas del worker / sync Prisma: `languageCode`, `errorLog`, `sentAt`, `templateParams` (JSONB).
- **`templateParams`:** lo escribe rulett-app; este repo solo lo lee y envía a Meta. No recalcular variables aquí.
- **No renombrar columnas** sin coordinar con el schema Prisma de la app principal.
- Detalle completo: [`openspec/runbooks/DATABASE.md`](./openspec/runbooks/DATABASE.md)

## Comandos esenciales

```bash
npm install          # Instalar dependencias
npm run build        # Compilar TypeScript → dist/
npm start            # Producción (dist/index.js)
npm run dev          # Desarrollo con hot-reload (tsx)
npm run typecheck    # Verificar tipos sin compilar
npm test             # Pruebas node:test + tsx (test/*.test.ts, fuera de src/)
npm run test:coverage # Igual, con cobertura de src/

npm run db:schema    # Aplicar migraciones del worker (solo Docker local, nunca Neon)
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

- No expandir a API REST pública (solo `/api/trigger` y `/health` existentes).
- No agregar ORM (Prisma) — el worker usa SQL directo con `pg`.
- No commitear `.env`, tokens ni credenciales.
- No cambiar nombres de tabla/columna sin actualizar `openspec/runbooks/DATABASE.md` y coordinar con Prisma.
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

- **Render:** **Web Service** (no Background Worker) — Build: `npm install && npm run build`, Start: `npm start`, health: `GET /health`
- **Railway:** Web service con `PORT` expuesto
- **Docker:** `Dockerfile` multi-stage, `EXPOSE 8080`

Detalle: [`openspec/runbooks/DEPLOYMENT.md`](./openspec/runbooks/DEPLOYMENT.md)

## Documentación extendida

| Documento | Contenido |
|---|---|
| [`openspec/README.md`](openspec/README.md) | **OpenSpec SDD — fuente canónica** |
| [`openspec/specs/`](openspec/specs/system_architecture.md) | Arquitectura, dominio, integraciones |
| [`openspec/changes/active/README.md`](openspec/changes/active/README.md) | Estado: en curso y último cierre |
| [`openspec/changes/completed/README.md`](openspec/changes/completed/README.md) | Historial de cambios cerrados |
| [`README.md`](README.md) | Overview humano + quick start |
| [`openspec/runbooks/ARCHITECTURE.md`](./openspec/runbooks/ARCHITECTURE.md) | Referencia extendida (puede describir Render/sondeo; manda `openspec/specs/`) |
| [`openspec/runbooks/DATABASE.md`](./openspec/runbooks/DATABASE.md) | Runbook SQL → OpenSpec domain_model |
| [`openspec/runbooks/DEVELOPMENT.md`](./openspec/runbooks/DEVELOPMENT.md) | Setup local, scripts, debugging |
| [`openspec/runbooks/DEPLOYMENT.md`](./openspec/runbooks/DEPLOYMENT.md) | Render, Railway, Docker |
| [`openspec/runbooks/CONVENTIONS.md`](./openspec/runbooks/CONVENTIONS.md) | Estándares de código TypeScript |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Flujo de contribución |

## Estado actual del proyecto

- Polling + trigger HTTP (`POST /api/trigger` con `Authorization: Bearer WORKER_API_KEY`).
- `GET /health` para Render/Railway.
- Claim optimista `FOR UPDATE SKIP LOCKED` y envío Meta Graph API v25.0 con `components` + `parameter_name`.
- Plantillas de comercio (header `nombre_tenant` + body): `recordatorio_cupon_vencer`, `cumpleanos_regalo_tenant`, `invitacion_evento_exclusivo`, `promocion_relampago` (`es_CO`).
- Plantillas v2 (056): las mismas cuatro con sufijo `_v2` más el botón URL dinámico «Información del comercio» (`parameters: [{ type: "text", text: <tenantId> }]`, `index` = `WHATSAPP_V2_BUTTON_INDEX`). `nombre_tenant` va solo en el header; `boton_comercio` debe ser un UUID o la fila termina `FAILED` sin llamar a Meta. Despliega el worker **antes** de activar una v2 en rulett-app (`WHATSAPP_V2_TEMPLATES_APPROVED`). El worker ignora `trigger`, `reason`, `contactId` y el estado `CANCELLED`. Detalle: `openspec/specs/integrations.md`.
- Avisos de suscripción (solo body, `origin = PLATFORM`, `qrCampaignId` null): `recordatorio_suscripcion_7d`, `recordatorio_suscripcion_hoy` — SDD `openspec/changes/completed/051-recordatorio-juego-descubre/` (el aviso de 1 día usa `recordatorio_suscripcion_7d` con `dias` `"1"`; `recordatorio_suscripcion_hoy` ya no se encola, 054). `parseTemplateParams` valida por plantilla.
- Deuda conocida (056, D-10): varias secciones de este archivo describen el sondeo y Render, que el build de `cloud-run` ya no usa (ver `openspec/runbooks/DEPLOYMENT.md`). No se corrige en 056; solo se actualizó lo de plantillas.
- Calificación del pedido (068): `calificar_pedido` (header `nombre_tenant`; body `nombre_usuario`, `numero_pedido`, `nombre_sede`, `fecha_pedido`; botón URL dinámico con `boton_calificacion`, token de 38 caracteres). Rama propia por nombre exacto en `parseTemplateParams` y `buildTemplateComponents`, aparte de las v2. Detalle: `openspec/specs/integrations.md`.
- Logs sin nombre ni teléfono del destinatario (068 W-05): solo id de fila, comercio, campaña, plantilla, estado y código de Meta.
- Compatible con schema Prisma (`Tenant`, `QrCampaign`, `WhatsappQueue`).
- Límite mensual por tenant se aplica en **rulett-app** al encolar; el worker solo procesa lo que hay en cola.
- Docker Compose PostgreSQL local :5440; scripts seed/schema/inspect.
- Tests unitarios con `node:test` + `tsx` en `test/` (`npm test`, `npm run test:coverage`); sin dependencias nuevas. Mocks: `fetch` global y repositorio/cliente falsos, sin BD.

## Puntos de extensión futuros (no implementados)

- Reintentos automáticos para `FAILED` (con backoff).
- Procesamiento paralelo controlado (con rate limiter).
- Métricas / observabilidad (Prometheus, Datadog).
- Soporte para templates con parámetros dinámicos (`components`).
