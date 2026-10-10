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
| `recordatorio_suscripcion_7d` | ninguno | `nombre_comercio`, `dias` (texto `"7"` o `"1"`) |
| `recordatorio_suscripcion_hoy` | ninguno | `nombre_comercio` (ya no se encola desde 054; el aviso de 1 día usa la de 7 días con `dias` = `"1"`) |

`nombre_tenant` se repite en header y body cuando la plantilla Meta lo exige (`recordatorio_cupon_vencer`, `invitacion_evento_exclusivo`).

Los dos `recordatorio_suscripcion_*` son el aviso de Rulett al contacto del comercio (filas `origin = PLATFORM`, `qrCampaignId` null). Solo body: no llevan header ni `nombre_tenant`/`nombre_usuario`. El botón URL «Pagar suscripción» es estático en Meta y **no** viaja en el POST. Contrato: [051](../changes/completed/051-recordatorio-juego-descubre/closure.md), modificado por [054](../changes/completed/054-gemini-aviso-cloud-run/closure.md), y `rulett-app/openspec/specs/integrations.md`.

`parseTemplateParams` valida por plantilla: las cuatro de comercio y las desconocidas exigen `nombre_tenant` y `nombre_usuario`; los avisos exigen `nombre_comercio` (y `dias` en la de 7 días) como texto no vacío. Si falta, la fila queda `FAILED` con `templateParams vacío` sin llamar a Meta. Una plantilla desconocida con params válidos cae al header `nombre_tenant`.

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
| `WORKER_API_KEY` | Validar `Authorization: Bearer` en `/api/trigger` (único secreto del worker) |
| IAM Cloud Run | Con la URL `run.app`, rulett-app manda además `X-Serverless-Authorization` con token de identidad; sin él Google responde 403 |
| Invocación | `POST /api/trigger` desde Vercel cron o admin |

## PostgreSQL (Neon)

- Misma `DATABASE_URL` que rulett-app
- SSL auto según host
- Pool `pg` max 10 conexiones

## Cloud Run (054) y Render

- Cloud Run: servicio con autenticación requerida; `GET /health` sin secretos si la petición entra al proceso. Runbook en [054 design](../changes/completed/054-gemini-aviso-cloud-run/design.md).
- Render (servicio anterior): Web Service con puerto HTTP; Build `npm install && npm run build`; Start `npm start`. No debe recibir el build sin sondeo mientras atienda producción.
