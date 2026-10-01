# Contratos — whatsapp_rulett-app

estado: borrador — pendiente de validación humana
Actualizado: 2026-10-01

## Entrada

- `GET /health`
- `GET|POST /api/trigger` con `Authorization: Bearer WORKER_API_KEY`. Dispara un lote; no crea filas. [repo: src/server.ts]
- Polling propio además del trigger. [repo: src/index.ts]

## Fila que consume

`tenantId`, `qrCampaignId` (null en filas `origin = PLATFORM`), `userPhone`, `userName`, `templateName`, `templateParams` (JSONB, validado por plantilla; vacío o incompleto → `FAILED` sin llamar a Meta), `languageCode`, `status`. El worker no lee `origin`. [repo: docs/DATABASE.md] [repo: src/db/queue.ts]

## Salida hacia Meta

`POST https://graph.facebook.com/v25.0/{WHATSAPP_PHONE_ID}/messages` con `type: template` y `parameter_name`. [repo: openspec/specs/integrations.md]

Plantillas conocidas: `recordatorio_cupon_vencer`, `cumpleanos_regalo_tenant`, `invitacion_evento_exclusivo`, `promocion_relampago` (header `nombre_tenant` + body), y `recordatorio_suscripcion_7d`, `recordatorio_suscripcion_hoy` (solo body, sin header; el botón URL estático no va en el POST). [repo: openspec/specs/integrations.md] [repo: src/services/whatsapp.ts]
