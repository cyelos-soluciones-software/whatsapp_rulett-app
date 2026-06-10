# Despliegue

## Requisitos de producción

| Recurso | Detalle |
|---|---|
| Runtime | Node.js ≥ 20 LTS |
| Tipo de servicio | **Web Service** (expone `POST /api/trigger` + polling en background) |
| Base de datos | PostgreSQL (Neon recomendado) |
| Variables de entorno | Ver `.env.example` |
| Build | `npm install && npm run build` |
| Start | `npm start` |

## Variables de entorno en producción

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/rulett_db?sslmode=require
DATABASE_SSL=true
POLL_INTERVAL_MS=60000
BATCH_SIZE=50
WHATSAPP_TOKEN=EAAxxxxx
WHATSAPP_PHONE_ID=1064133880126015
WHATSAPP_ACCOUNT_ID=868325479011642
WHATSAPP_LANGUAGE_CODE=es_CO
WORKER_API_KEY=secreto_largo_aleatorio
PORT=8080
NODE_ENV=production
```

`PORT` lo asigna Render automáticamente en Web Service; no hace falta fijarlo manualmente.

**Antes del primer deploy:** ejecutar `npm run db:schema` contra la BD de producción para agregar columnas del worker.

---

## Render

### Crear Web Service

1. **New → Web Service** (no Background Worker: necesita puerto HTTP para `/api/trigger`)
2. Conectar repositorio Git
3. Configurar:

| Campo | Valor |
|---|---|
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Environment | Node |

4. Agregar variables de entorno en el dashboard.
5. Deploy.

### Notas Render

- Render envía `SIGTERM` al redeploy — el worker lo maneja con graceful shutdown.
- Configurar health check en `GET /health` (recomendado en Web Service).
- Logs disponibles en el dashboard (formato JSON).
- Para escalar: aumentar número de instancias (el claim con `SKIP LOCKED` lo soporta).

---

## Railway

### Crear servicio

1. **New Project → Deploy from GitHub**
2. Railway detecta Node.js automáticamente.
3. Configurar variables de entorno.
4. Override de comandos si es necesario:

| Campo | Valor |
|---|---|
| Build | `npm install && npm run build` |
| Start | `npm start` |

### Notas Railway

- Railway también envía `SIGTERM` en redeploys.
- Conectar Neon via `DATABASE_URL` en variables.
- Exponer puerto HTTP (`PORT`) — necesario para `/api/trigger` desde rulett-app.

---

## Docker

### Build

```bash
docker build -t whatsapp-worker .
```

### Run

```bash
docker run --env-file .env --name whatsapp-worker whatsapp-worker
```

### Dockerfile (multi-stage)

- **Stage 1 (builder):** Instala deps, compila TypeScript.
- **Stage 2 (runner):** Solo deps de producción + `dist/`. Usuario no-root (`app`).

### Docker Compose (solo BD)

El `docker-compose.yml` incluido levanta **solo PostgreSQL** para desarrollo local. El worker se ejecuta con `npm run dev` o `npm start` fuera del contenedor.

Para containerizar worker + BD juntos, crear un `docker-compose.prod.yml` separado (no incluido aún).

---

## Neon PostgreSQL

1. Crear proyecto en [neon.tech](https://neon.tech).
2. Copiar connection string del dashboard.
3. Configurar `DATABASE_URL` y `DATABASE_SSL=true`.
4. Ejecutar schema:

```bash
DATABASE_URL="postgresql://..." npm run db:schema
```

### Connection pooling

Neon ofrece connection string con pooler (`-pooler` en el host). Recomendado para producción con múltiples réplicas del worker.

---

## Checklist pre-deploy

- [ ] `npm run build` exitoso
- [ ] `npm run db:schema` ejecutado en BD de producción (incl. columna `templateParams`)
- [ ] Variables de entorno configuradas (sin commitear `.env`)
- [ ] `WORKER_API_KEY` idéntica en Render y Vercel (`rulett-app`)
- [ ] `WHATSAPP_TOKEN` válido y no expirado
- [ ] Templates de WhatsApp aprobados en Meta Business Manager
- [ ] Índice `idx_whatsapp_queue_pending` existe
- [ ] Probar con 1 registro PENDING antes de escalar

## Escalado horizontal

El worker soporta múltiples réplicas gracias a `FOR UPDATE SKIP LOCKED`:

```
Worker 1 ──claim──▶ [msg1, msg2]
Worker 2 ──claim──▶ [msg3, msg4]     (sin duplicados)
Worker 3 ──claim──▶ [msg5]
```

Consideraciones al escalar:
- Meta impone rate limits (~80 msg/s por número, varía por tier).
- Ajustar `BATCH_SIZE` y `POLL_INTERVAL_MS` según volumen.
- Monitorear registros `FAILED` por rate limiting.

## Monitoreo

Actualmente el worker emite logs JSON a stdout. En producción:

- **Render:** Logs tab en dashboard.
- **Railway:** Deploy logs + `railway logs`.
- **Docker:** `docker logs whatsapp-worker`.

Campos clave para alertas:
- `"level":"error"` — fallos de envío o ciclo de polling.
- `"message":"Fallo al enviar mensaje"` — error de Meta API.
- Registros `PROCESSING` huérfanos > 10 min — worker crasheó.
