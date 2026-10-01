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
| `recordatorio_suscripcion_7d` | sin header; body: `nombre_comercio`, `dias` (texto `"7"`) |
| `recordatorio_suscripcion_hoy` | sin header; body: `nombre_comercio` |

La validación es por plantilla (`parseTemplateParams`): las de comercio exigen `nombre_tenant` y `nombre_usuario`; los avisos de suscripción no los traen. Params incompletos → `FAILED` sin llamar a Meta. La columna `origin` (`TENANT` | `PLATFORM`) la usa rulett-app; el worker no la lee. Contrato: [`docs/sdd/17tnjra85qn/`](../../docs/sdd/17tnjra85qn/design.md).

Mapeo en `src/services/whatsapp.ts` con `parameter_name` (Graph API v25.0). Tras cambios: redeploy Render. Cambio: [005](../changes/completed/005-invitacion-evento-whatsapp/closure.md).

## Migraciones worker

`sql/schema.sql` — idempotente (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

Comando: `npm run db:schema`.
