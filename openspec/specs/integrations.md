# Especificación: Integraciones

**Repositorio:** whatsapp_rulett-app

## Meta WhatsApp Cloud API

- **Versión:** Graph API v25.0
- **Endpoint:** `POST https://graph.facebook.com/v25.0/{WHATSAPP_PHONE_ID}/messages`
- **Auth:** `Bearer WHATSAPP_TOKEN`
- **Tipo mensaje:** `template` con `components` y `parameter_name`

### Mapeo por plantilla (`buildTemplateComponents`)

| `templateName` | header (orden) | body (orden) |
|----------------|----------------|--------------|
| `recordatorio_cupon_vencer` | `nombre_tenant` | `nombre_usuario`, `cupon`, `nombre_tenant`, `fecha_vencimiento` |
| `cumpleanos_regalo_tenant` | `nombre_tenant` | `nombre_usuario`, `mes_cumpleanos`, `regalo_usuario` |
| `invitacion_evento_exclusivo` | `nombre_tenant` | `nombre_usuario`, `nombre_tenant`, `nombre_evento`, `fecha_evento` |
| `promocion_relampago` | `nombre_tenant` | `nombre_tenant`, `nombre_usuario`, `fecha_limite`, `descuento_promo`, `producto_servicio` |

`nombre_tenant` se repite en header y body cuando la plantilla Meta lo exige (`recordatorio_cupon_vencer`, `invitacion_evento_exclusivo`).

### Troubleshooting Meta

| Código | HTTP | Causa | Acción |
|--------|------|-------|--------|
| `190` | 401 | `WHATSAPP_TOKEN` inválido/expirado | Token permanente System User en Render |
| `131030` | 400 | Destinatario no en lista (modo Dev) | Meta API Setup + OTP; o app Live |
| `132000` | 400 | Params no coinciden con plantilla | Auditar WhatsApp Manager; fix `whatsapp.ts`; **deploy Render** |
| `132005` | 400 | Variable demasiado larga | Acortar `cupon` / `nombre_tenant` (especialmente header) |

### Scripts de verificación

| Script | Uso |
|--------|-----|
| `scripts/process-one-batch.ts` | Un lote PENDING (dev; requiere token Meta válido) |

E2E coordinado: rulett-app `scripts/e2e-whatsapp-templates.ts` + trigger `POST /api/trigger`.

Cambios: [002](../changes/completed/002-whatsapp-template-params/closure.md), [005](../changes/completed/005-invitacion-evento-whatsapp/closure.md).

## rulett-app (trigger)

| Variable | Uso |
|----------|-----|
| `WORKER_API_KEY` | Validar `Authorization: Bearer` en `/api/trigger` |
| Invocación | `POST /api/trigger` desde Vercel cron o admin |

## PostgreSQL (Neon)

- Misma `DATABASE_URL` que rulett-app
- SSL auto según host
- Pool `pg` max 10 conexiones

## Render

- Web Service con puerto HTTP
- Health check: `GET /health`
- Build: `npm install && npm run build`
- Start: `npm start`
