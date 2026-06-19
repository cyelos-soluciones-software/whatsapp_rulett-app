# Especificación: Modelo de dominio (worker)

**Tabla principal:** `"WhatsappQueue"` (PostgreSQL, schema Prisma de rulett-app)

## Entidad WhatsappQueue

| Columna | Tipo | Worker |
|---------|------|--------|
| `id` | TEXT PK | Claim / update |
| `tenantId` | TEXT FK | Solo lectura |
| `qrCampaignId` | TEXT FK | Solo lectura |
| `userPhone` | TEXT | Destino Meta (`to`) |
| `userName` | TEXT | No enviado a Meta (logging) |
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

Mapeo en `src/services/whatsapp.ts` con `parameter_name` (Graph API v25.0).

## Migraciones worker

`sql/schema.sql` — idempotente (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

Comando: `npm run db:schema`.
