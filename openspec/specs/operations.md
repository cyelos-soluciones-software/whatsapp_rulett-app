# Especificación: Operaciones

**Repositorio:** whatsapp_rulett-app

## Variables requeridas

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Neon / PostgreSQL |
| `WHATSAPP_TOKEN` | Bearer Meta |
| `WHATSAPP_PHONE_ID` | ID número WhatsApp |
| `WHATSAPP_ACCOUNT_ID` | Logging |
| `POLL_INTERVAL_MS` | Intervalo polling (default 60000) |
| `WORKER_API_KEY` | Auth trigger (prod obligatorio) |

Opcionales: `BATCH_SIZE`, `WHATSAPP_LANGUAGE_CODE`, `DATABASE_SSL`.

Ver `.env.example`.

## Comandos

```bash
npm run dev          # tsx hot-reload
npm run build        # tsc → dist/
npm start            # producción
npm run db:schema    # aplicar sql/schema.sql
npm run db:inspect   # inspección cola
```

## Deploy coordinado con rulett-app

1. rulett-app: `prisma db push` (columna `templateParams`)
2. worker: `npm run db:schema`
3. Deploy Render + redeploy Vercel
4. Smoke: encolar 1 mensaje + trigger

## Local

Docker Compose PostgreSQL puerto `5440` — ver `docs/DEVELOPMENT.md`.
