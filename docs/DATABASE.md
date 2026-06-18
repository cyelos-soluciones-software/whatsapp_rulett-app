# Base de datos

> **Fuente canónica:** [../openspec/specs/domain_model.md](../openspec/specs/domain_model.md). Runbook SQL detallado a continuación.

## Contexto

La base de datos PostgreSQL es **compartida** con la aplicación principal Rulett (ORM: **Prisma**). Este worker **solo lee y actualiza** la tabla `"WhatsappQueue"`. No crea tenants, campañas ni usuarios.

## Tablas relevantes

### `"WhatsappQueue"` (principal)

Cola de mensajes WhatsApp pendientes de envío.

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | TEXT | NO | PK (UUID/cuid generado por Prisma) |
| `tenantId` | TEXT | NO | FK → `"Tenant".id` |
| `qrCampaignId` | TEXT | NO | FK → `"QrCampaign".id` |
| `userPhone` | TEXT | NO | Teléfono destino (formato internacional sin `+`) |
| `userName` | TEXT | NO | Nombre del destinatario |
| `templateName` | TEXT | NO | Nombre de la plantilla aprobada en Meta |
| `templateParams` | JSONB | SÍ | Variables pre-calculadas por rulett-app (requerido para envío) |
| `status` | TEXT | NO | Estado del mensaje (ver máquina de estados) |
| `languageCode` | TEXT | NO | Código idioma template (default: `es_CO`) |
| `errorLog` | TEXT | SÍ | Motivo del fallo (max ~4000 chars) |
| `createdAt` | TIMESTAMP | NO | Fecha de creación |
| `updatedAt` | TIMESTAMP | NO | Última actualización |
| `sentAt` | TIMESTAMPTZ | SÍ | Fecha de envío exitoso |

**Convención Prisma:** nombres en camelCase con comillas dobles en SQL.

### `templateParams` (JSON)

Insertado por **rulett-app** al encolar. El worker **no** calcula variables; solo las envía a Meta.

| Plantilla | Claves JSON |
|-----------|-------------|
| `recordatorio_cupon_vencer` | header: `nombre_tenant`; body (orden): `nombre_usuario`, `cupon`, `nombre_tenant`, `fecha_vencimiento` |
| `cumpleanos_regalo_tenant` | `nombre_tenant`, `nombre_usuario`, `mes_cumpleanos`, `regalo_usuario` |

Mapeo en `src/services/whatsapp.ts`: `nombre_tenant` → componente `header` y de nuevo en `body` si la plantilla lo repite; demás claves → `body` con `parameter_name` (Graph API v25.0).

Columna añadida por Prisma (`db push`) y por `sql/schema.sql` (`ALTER TABLE ... templateParams JSONB`).

### `"Tenant"` (referencia, no modificada por el worker)

| Columna clave | Descripción |
|---|---|
| `id` | UUID del tenant |
| `name` | Nombre del negocio |
| `isActive` | Debe ser `true` para operar |

### `"QrCampaign"` (referencia, no modificada por el worker)

| Columna clave | Descripción |
|---|---|
| `id` | UUID de la campaña QR |
| `tenantId` | FK al tenant propietario |
| `name` | Nombre de la campaña |
| `isActive` | Debe ser `true` para operar |

## Máquina de estados

```
                    ┌──────────────┐
                    │   PENDING    │  ← Insertado por app Rulett
                    └──────┬───────┘
                           │ claimPendingBatch()
                           ▼
                    ┌──────────────┐
                    │  PROCESSING  │  ← Reclamado por worker
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │ sendTemplateMessage()   │
              ▼                         ▼
       ┌──────────────┐          ┌──────────────┐
       │     SENT     │          │    FAILED    │
       │  (+ sentAt)  │          │ (+ errorLog) │
       └──────────────┘          └──────────────┘
```

### Reglas

- Solo registros con `status = 'PENDING'` son reclamados.
- Un registro en `PROCESSING` indica que un worker lo está procesando.
- Si un worker muere en `PROCESSING`, el registro queda huérfano (no hay recovery automático aún).
- `FAILED` no se reintenta automáticamente.

## Queries del worker

### Claim (bloqueo optimista)

```sql
UPDATE "WhatsappQueue" AS q
SET status = 'PROCESSING', "updatedAt" = NOW()
FROM (
  SELECT id FROM "WhatsappQueue"
  WHERE status = 'PENDING'
  ORDER BY "createdAt" ASC
  LIMIT $1
  FOR UPDATE SKIP LOCKED
) AS pending
WHERE q.id = pending.id
RETURNING *;
```

### Mark sent

```sql
UPDATE "WhatsappQueue"
SET status = 'SENT', "errorLog" = NULL, "sentAt" = NOW(), "updatedAt" = NOW()
WHERE id = $1;
```

### Mark failed

```sql
UPDATE "WhatsappQueue"
SET status = 'FAILED', "errorLog" = $2, "updatedAt" = NOW()
WHERE id = $1;
```

## Migraciones

El archivo `sql/schema.sql` es **idempotente** y seguro de ejecutar múltiples veces:

- Crea `"WhatsappQueue"` si no existe (solo en entornos nuevos).
- Agrega columnas del worker (`languageCode`, `errorLog`, `sentAt`) con `ADD COLUMN IF NOT EXISTS`.
- Crea índice parcial para `PENDING`.

```bash
npm run db:schema    # Aplica via Node (no requiere psql)
```

## Índices

```sql
CREATE INDEX idx_whatsapp_queue_pending
  ON "WhatsappQueue" (status, "createdAt")
  WHERE status = 'PENDING';
```

Optimiza el claim de mensajes pendientes ordenados por antigüedad.

## Seed de datos de prueba

```bash
# Resuelve automáticamente tenant/campaña activos de la BD
npm run db:seed

# Con parámetros
npm run db:seed -- --count 5 --phone 3123058273 --template recordatorio_cupon_vencer

# Forzar IDs
npm run db:seed -- --tenant <uuid> --campaign <uuid>
```

**Importante:** El seed respeta FKs. Si no hay `Tenant`/`QrCampaign`, usa IDs demo (`dev-tenant-001`) del bootstrap Docker.

## Conexión

| Entorno | `DATABASE_URL` | `DATABASE_SSL` |
|---|---|---|
| Local (Docker) | `postgresql://rulett_admin:rulett_secure_password_local@localhost:5440/rulett_db` | `false` |
| Neon (prod) | URL de Neon dashboard | `true` |

Neon requiere SSL. El worker configura `ssl: { rejectUnauthorized: false }` cuando `DATABASE_SSL=true`.

## Consultas útiles

```sql
-- Mensajes pendientes
SELECT id, "userPhone", "templateName", status, "createdAt"
FROM "WhatsappQueue"
WHERE status = 'PENDING'
ORDER BY "createdAt";

-- Mensajes fallidos recientes
SELECT id, "userPhone", "templateName", "errorLog", "updatedAt"
FROM "WhatsappQueue"
WHERE status = 'FAILED'
ORDER BY "updatedAt" DESC
LIMIT 20;

-- Resumen por estado
SELECT status, COUNT(*) FROM "WhatsappQueue" GROUP BY status;

-- Huérfanos en PROCESSING (worker murió)
SELECT * FROM "WhatsappQueue"
WHERE status = 'PROCESSING'
  AND "updatedAt" < NOW() - INTERVAL '10 minutes';
```
