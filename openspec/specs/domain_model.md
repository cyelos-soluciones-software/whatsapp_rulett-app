# Especificación: Modelo de dominio (worker)

**Tabla principal:** `"WhatsappQueue"` (PostgreSQL, schema Prisma de rulett-app)

## Entidad WhatsappQueue

| Columna | Tipo | Worker |
|---------|------|--------|
| `id` | TEXT PK | Claim / update |
| `tenantId` | TEXT FK | Solo lectura |
| `qrCampaignId` | TEXT FK, nullable | Solo lectura. Null en filas `origin = PLATFORM` (aviso de suscripción) |
| `userPhone` | TEXT | Destino Meta (`to`). En logs solo los últimos 4 dígitos |
| `userName` | TEXT | No enviado a Meta (logging). En el aviso = nombre del comercio |
| `templateName` | TEXT | `template.name` |
| `templateParams` | JSONB | **Obligatorio** → `components` |
| `status` | TEXT | PENDING → PROCESSING → SENT \| FAILED |
| `languageCode` | TEXT | Default `es_CO` |
| `errorLog` | TEXT | Escrito en FAILED |
| `sentAt` | TIMESTAMPTZ | Escrito en SENT |
| `createdAt`, `updatedAt` | TIMESTAMP | Auditoría |

## Máquina de estados

```
PENDING ──claim──▶ PROCESSING ──send──▶ SENT (+ sentAt)
                              └──fail──▶ FAILED (+ errorLog)
```

## Contrato `templateParams`

Insertado por **rulett-app**. Worker valida y mapea:

| Plantilla | Claves JSON |
|-----------|-------------|
| `recordatorio_cupon_vencer` | header: `nombre_tenant`; body: `nombre_usuario`, `cupon`, `nombre_tenant`, `fecha_vencimiento` |
| `cumpleanos_regalo_tenant` | header: `nombre_tenant`; body: `nombre_usuario`, `mes_cumpleanos`, `regalo_usuario` |
| `invitacion_evento_exclusivo` | header: `nombre_tenant`; body: `nombre_usuario`, `nombre_tenant`, `nombre_evento`, `fecha_evento` |
| `promocion_relampago` | header: `nombre_tenant`; body: `nombre_tenant`, `nombre_usuario`, `fecha_limite`, `descuento_promo`, `producto_servicio` |
| `recordatorio_suscripcion_7d` | sin header; body: `nombre_comercio`, `dias` (texto `"7"` o `"1"` desde 054) |
| `recordatorio_suscripcion_hoy` | sin header; body: `nombre_comercio` (ya no se encola desde 054) |

La validación es por plantilla (`parseTemplateParams`): las de comercio exigen `nombre_tenant` y `nombre_usuario`; los avisos de suscripción no los traen. Params incompletos → `FAILED` sin llamar a Meta. La columna `origin` (`TENANT` | `PLATFORM`) la usa rulett-app; el worker no la lee. Contrato: [051](../changes/completed/051-recordatorio-juego-descubre/closure.md) y [054](../changes/completed/054-gemini-aviso-cloud-run/closure.md).

**056 (plantillas v2):** `recordatorio_cupones_vencer_v2`, `cumpleanos_regalo_tenant_v2`, `invitacion_evento_exclusivo_v2` y `promocion_relampago_v2` exigen, no vacíos, `nombre_tenant`, las variables de su cuerpo (`recordatorio_...`: `nombre_usuario`, `cantidad_cupones`, `cupon`, `fecha_vencimiento`; `cumpleanos_...`: `nombre_usuario`, `mes_cumpleanos`, `regalo_usuario`; `invitacion_...`: `nombre_usuario`, `nombre_evento`, `fecha_evento`; `promocion_...`: `nombre_usuario`, `fecha_limite`, `descuento_promo`, `producto_servicio`) y `boton_comercio` (UUID del tenant, parámetro del botón URL). Detalle y mapeo en [`integrations.md`](./integrations.md). El worker no lee `trigger`, `reason` ni `contactId`, ni procesa el estado `CANCELLED`: solo reclama `PENDING`.

Mapeo en `src/services/whatsapp.ts` con `parameter_name` (Graph API v25.0). Tras cambios: redeploy Render. Cambio: [005](../changes/completed/005-invitacion-evento-whatsapp/closure.md).

## Migraciones worker

`sql/schema.sql` — idempotente (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

Comando: `npm run db:schema`.
