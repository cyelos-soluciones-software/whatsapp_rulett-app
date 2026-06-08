# Desarrollo local

## Prerrequisitos

- **Node.js** ≥ 20 LTS
- **npm** ≥ 9
- **Docker Desktop** (opcional, para PostgreSQL local)
- Cuenta **Meta Business** con WhatsApp Cloud API configurada
- Acceso a la BD PostgreSQL (local o Neon)

## Setup inicial

```bash
# Clonar e instalar
git clone <repo-url>
cd whatsapp_rulett.app
npm install

# Configurar entorno
cp .env.example .env
```

Editar `.env`:

```env
DATABASE_URL=postgresql://rulett_admin:rulett_secure_password_local@localhost:5440/rulett_db
DATABASE_SSL=false
POLL_INTERVAL_MS=60000
BATCH_SIZE=50
WHATSAPP_TOKEN=<tu-token-meta>
WHATSAPP_PHONE_ID=1064133880126015
WHATSAPP_ACCOUNT_ID=868325479011642
WHATSAPP_LANGUAGE_CODE=es_CO
WORKER_API_KEY=dev_secret_local
PORT=8080
```

Probar trigger local:

```bash
curl -X POST http://localhost:8080/api/trigger \
  -H "Authorization: Bearer dev_secret_local"
```

## Opción A: PostgreSQL con Docker

```bash
npm run db:setup    # Levanta Postgres + schema + seed
```

Esto ejecuta en orden:
1. `docker compose up -d --wait` — PostgreSQL 16 en puerto **5440**
2. `npm run db:schema` — Columnas del worker
3. `npm run db:seed` — 3 registros PENDING de prueba

**Nota:** Si el puerto 5440 ya está ocupado, cambia el mapping en `docker-compose.yml` o detén el servicio existente.

### Credenciales Docker

| Campo | Valor |
|---|---|
| Host | `localhost` |
| Puerto | `5440` |
| Usuario | `rulett_admin` |
| Password | `rulett_secure_password_local` |
| Base de datos | `rulett_db` |

## Opción B: BD existente (Neon o Postgres local)

Si ya tienes la BD de Rulett con Prisma:

```bash
npm run db:schema    # Agrega columnas languageCode, errorLog, sentAt
npm run db:inspect   # Verificar tablas y datos
npm run db:seed      # Insertar registros de prueba (opcional)
```

## Ejecutar el worker

```bash
# Desarrollo (hot-reload)
npm run dev

# Producción local
npm run build
npm start
```

### Salida esperada

```json
{"ts":"2026-05-30T...","level":"info","message":"Worker iniciado","pollIntervalMs":60000,"batchSize":50,...}
{"ts":"2026-05-30T...","level":"info","message":"Lote reclamado","count":3}
{"ts":"2026-05-30T...","level":"info","message":"Procesando mensaje","queueId":"...","userPhone":"..."}
{"ts":"2026-05-30T...","level":"info","message":"Mensaje enviado","queueId":"...","messageId":"wamid...."}
```

## Scripts de utilidad

| Script | Comando | Descripción |
|---|---|---|
| `scripts/seed.ts` | `npm run db:seed` | Inserta PENDING con FKs válidas |
| `scripts/apply-schema.ts` | `npm run db:schema` | Aplica `sql/schema.sql` |
| `scripts/apply-sql.ts` | `npx tsx scripts/apply-sql.ts sql/seed.sql` | Ejecuta SQL arbitrario |
| `scripts/inspect-db.ts` | `npm run db:inspect` | Muestra tablas y muestras |

### Seed con parámetros

```bash
npm run db:seed -- --count 10
npm run db:seed -- --phone 3123058273 --template hello_world
npm run db:seed -- --tenant <uuid> --campaign <uuid> --language es_CO
```

Variables opcionales en `.env`:

```env
SEED_TENANT_ID=<uuid>
SEED_QR_CAMPAIGN_ID=<uuid>
```

## Verificación de tipos

```bash
npm run typecheck
```

## Debugging

### El worker no procesa mensajes

1. Verificar que hay registros PENDING: `npm run db:inspect`
2. Verificar conexión BD: revisar logs de inicio (`Worker iniciado`)
3. Verificar `DATABASE_SSL` coincide con el entorno

### Meta API retorna error

1. Verificar `WHATSAPP_TOKEN` no expirado
2. Verificar que `templateName` existe y está aprobado en Meta Business Manager
3. Verificar formato de `userPhone` (internacional sin `+`, ej. `573001234567`)
4. Revisar `"errorLog"` en la fila FAILED:

```sql
SELECT "errorLog" FROM "WhatsappQueue" WHERE status = 'FAILED' ORDER BY "updatedAt" DESC LIMIT 5;
```

### Registros atascados en PROCESSING

Indica que un worker murió mid-batch. Reset manual:

```sql
UPDATE "WhatsappQueue"
SET status = 'PENDING', "updatedAt" = NOW()
WHERE status = 'PROCESSING'
  AND "updatedAt" < NOW() - INTERVAL '10 minutes';
```

## Estructura de archivos fuente

```
src/
  index.ts              # Entry point — no agregar lógica de negocio aquí
  config.ts             # Solo variables de entorno
  types.ts              # Tipos compartidos
  db/queue.ts           # Todo acceso SQL a WhatsappQueue
  services/whatsapp.ts  # Todo acceso HTTP a Meta API
```

Al agregar funcionalidad:
- Nueva query SQL → `src/db/queue.ts`
- Nueva llamada API → `src/services/whatsapp.ts`
- Nuevo tipo → `src/types.ts`
- Orquestación → `src/index.ts`

## Git

- **No commitear** `.env`
- `.env.example` sí se commitea (sin secretos)
- Ejecutar `npm run build` antes de commit para verificar compilación
