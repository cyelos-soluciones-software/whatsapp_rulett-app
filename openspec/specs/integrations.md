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

### Plantillas v2 con botón «Información del comercio» (056)

Mismas cuatro plantillas de comercio más un botón URL dinámico a `https://www.rulett.app/c/{{1}}`. Solo el nombre decide qué se arma: un `templateName` que termina en `_v2` y está en `V2_TEMPLATE_BODY_PARAMS` (`src/types.ts`). Las cuatro están aprobadas en Meta (categoría Marketing) con estos nombres; Meta registró la variable de la URL como posicional `{{1}}` y el botón dinámico es el segundo (índice 1), de modo que en producción `WHATSAPP_V2_BUTTON_INDEX` queda en su default y `WHATSAPP_V2_BUTTON_PARAM_NAME` sin definir.

| `templateName` | header | body (orden) | botones que viajan |
|----------------|--------|--------------|--------------------|
| `recordatorio_cupones_vencer_v2` | `nombre_tenant` | `nombre_usuario`, `cantidad_cupones`, `cupon`, `fecha_vencimiento` | URL dinámica (`boton_comercio`) |
| `cumpleanos_regalo_tenant_v2` | `nombre_tenant` | `nombre_usuario`, `mes_cumpleanos`, `regalo_usuario` | URL dinámica |
| `invitacion_evento_exclusivo_v2` | `nombre_tenant` | `nombre_usuario`, `nombre_evento`, `fecha_evento` | URL dinámica |
| `promocion_relampago_v2` | `nombre_tenant` | `nombre_usuario`, `fecha_limite`, `descuento_promo`, `producto_servicio` | URL dinámica |

- **`nombre_tenant` solo en el header.** El cuerpo de las v2 no lo repite (a diferencia de las v1 de invitación y promoción); un parámetro de más o de menos da el error 132000.
- **Botón:** `{ type: "button", sub_type: "url", index, parameters: [{ type: "text", text: <tenantId> }] }`. «Mira tus cupones» es URL estática en Meta y no viaja.
  - `index` sale de `WHATSAPP_V2_BUTTON_INDEX` (default `"1"`; debe coincidir con el orden de botones aprobado en Meta).
  - El parámetro va **posicional** salvo que `WHATSAPP_V2_BUTTON_PARAM_NAME` esté definida; entonces se manda también `parameter_name` con ese valor (p. ej. `boton_comercio`).
- **Validación (`parseTemplateParams`):** en las v2 todas las variables del cuerpo y `nombre_tenant` son obligatorias y no vacías, y `boton_comercio` debe ser un UUID 8-4-4-4-12. Es lo único que se concatena a la URL del botón. Si falta algo, `templateParams` queda `null` y la fila termina `FAILED` con `templateParams vacío`, sin llamar a Meta. Las claves desconocidas se descartan. Las v1 siguen siendo permisivas.
- **Orden de despliegue:** el worker se despliega antes de que rulett-app agregue algún nombre a `WHATSAPP_V2_TEMPLATES_APPROVED`; un worker anterior descartaría `boton_comercio` y Meta respondería 132000.
- **Fixture de contrato:** `test/fixtures/v2-contract.ts` tiene el JSON exacto de cada v2 y los `components` esperados; se replica en rulett-app (T-14).
- **Columnas que el worker ignora:** `trigger`, `reason` y `contactId` (056). `RETURNING_COLUMNS` es una lista explícita y el worker solo reclama `PENDING`, así que el estado `CANCELLED` (baja del cliente) nunca se procesa.

### Calificación del pedido `calificar_pedido` (068)

Rama propia (no es v2): la elige el nombre exacto `calificar_pedido` (`FEEDBACK_TEMPLATE_NAME`, `src/types.ts`). Categoría **Utilidad**, `es_CO`. La encola rulett-app 1 h después de finalizar un pedido vinculado a una billetera (`origin = TENANT`, `reason = ORDER_FEEDBACK`, `qrCampaignId` null).

| `templateName` | header | body (orden) | botón que viaja |
|----------------|--------|--------------|-----------------|
| `calificar_pedido` | `nombre_tenant` | `nombre_usuario`, `numero_pedido`, `nombre_sede`, `fecha_pedido` | URL dinámica a `https://www.rulett.app/f/{{1}}` con `boton_calificacion` |

- **Botón:** `{ type: "button", sub_type: "url", index, parameters: [{ type: "text", text: <token> }] }`. `index` sale de `WHATSAPP_FEEDBACK_BUTTON_INDEX` (default `"0"`, el único botón); el parámetro va posicional salvo que `WHATSAPP_FEEDBACK_BUTTON_PARAM_NAME` esté definida. Es una configuración aparte de la de las v2: cambiar una no toca la otra.
- **Validación (`parseTemplateParams`, `src/db/queue.ts`):** rama propia entre el aviso de suscripción y la v2. Todas las variables y `nombre_tenant` son texto no vacío, y `boton_calificacion` cumple `^[A-Za-z0-9_-]{38}$` (el token firmado del enlace, base64url). Si falta algo, `templateParams` queda `null` y la fila termina `FAILED` con `templateParams vacío`, sin llamar a Meta. Las claves desconocidas se descartan. La validación UUID de las v2 no cambia.
- **Orden de despliegue:** el worker se despliega antes de que rulett-app active `WHATSAPP_FEEDBACK_TEMPLATE_APPROVED=true`; un worker anterior armaría solo el header y Meta respondería 132000.
- **Fixture de contrato:** `test/fixtures/feedback-contract.ts`; la réplica de la app está en `rulett-app/src/lib/__tests__/fixtures/feedback-contract.ts`.
- **Pendiente (T-00):** al aprobarse en Meta se anotan aquí la categoría final, el índice del botón y la forma de la variable.

### Logs sin datos personales (068 W-05)

Ningún log del worker incluye el nombre ni el teléfono del destinatario, para ninguna plantilla. «Procesando mensaje» lleva `queueId`, `tenantId`, `campaignId` y `templateName`; «Mensaje enviado» y «Fallo al enviar mensaje» llevan `queueId`, `templateName`, `status` (`SENT` / `FAILED`), `statusCode` y, si falla, el error de Meta con su `code`.

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

Cambios: [002](../changes/completed/002-whatsapp-template-params/closure.md), [005](../changes/completed/005-invitacion-evento-whatsapp/closure.md), [056](../changes/completed/056-envios-automaticos-mensajes/closure.md) (plantillas v2 y botón dinámico).

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
