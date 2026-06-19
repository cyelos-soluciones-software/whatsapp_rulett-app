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

`nombre_tenant` se repite en header y body cuando la plantilla Meta lo exige (`recordatorio_cupon_vencer`).

### Troubleshooting Meta

| Código | HTTP | Causa | Acción |
|--------|------|-------|--------|
| `190` | 401 | `WHATSAPP_TOKEN` inválido/expirado | Token permanente System User en Render |
| `131030` | 400 | Destinatario no en lista (modo Dev) | Meta API Setup + OTP; o app Live |
| `132000` | 400 | Params no coinciden con plantilla | Auditar WhatsApp Manager; fix `whatsapp.ts` |

Cambio cerrado: [completed/002-whatsapp-template-params](../changes/completed/002-whatsapp-template-params/closure.md).

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
