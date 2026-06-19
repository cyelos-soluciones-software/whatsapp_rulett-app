# Cierre: 005 — invitacion_evento_exclusivo (worker)

**Fecha código:** 2026-06-19  
**E2E:** coordinado con rulett-app closure 005

## Entregado en código

- `src/services/whatsapp.ts` — rama `invitacion_evento_exclusivo` (body-only, 4 params).
- `src/types.ts` — `nombre_evento`, `fecha_evento`.
- `src/db/queue.ts` — parse JSON completo.
- `scripts/process-one-batch.ts`.

## E2E Render (2026-06-19)

| Plantilla | Worker Render | Resultado |
|-----------|---------------|-----------|
| `cumpleanos_regalo_tenant` | Desplegado (002) | SENT |
| `recordatorio_cupon_vencer` | Desplegado (002) | SENT (tenant Rulett) |
| `invitacion_evento_exclusivo` | **No desplegado** | FAILED #132000 |

## Acción requerida

1. Deploy Web Service Render (`npm run build` + restart).
2. Verificar `GET /health` → 200.
3. Re-encolar invitación desde rulett-app E2E script.

## Token

`WHATSAPP_TOKEN` en Render es la fuente válida para PDN. Token en `.env` local puede estar expirado (#190).
