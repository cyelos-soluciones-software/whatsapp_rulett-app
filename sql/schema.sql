-- Esquema compatible con WhatsappQueue (Prisma) + columnas del worker.
-- Idempotente: seguro ejecutar varias veces.

CREATE TABLE IF NOT EXISTS "WhatsappQueue" (
  id              TEXT PRIMARY KEY,
  "tenantId"      TEXT NOT NULL,
  "qrCampaignId"  TEXT NOT NULL,
  "userPhone"     TEXT NOT NULL,
  "userName"      TEXT NOT NULL,
  "templateName"  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  "languageCode"  TEXT NOT NULL DEFAULT 'es_CO',
  "errorLog"      TEXT,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt"        TIMESTAMPTZ
);

ALTER TABLE "WhatsappQueue" ADD COLUMN IF NOT EXISTS "languageCode" TEXT NOT NULL DEFAULT 'es_CO';
ALTER TABLE "WhatsappQueue" ADD COLUMN IF NOT EXISTS "errorLog" TEXT;
ALTER TABLE "WhatsappQueue" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMPTZ;
ALTER TABLE "WhatsappQueue" ADD COLUMN IF NOT EXISTS "templateParams" JSONB;

-- Filas origin PLATFORM (aviso de suscripción) van sin campaña. Solo Docker local:
-- en Neon la columna la cambia la migración Prisma de rulett-app.
ALTER TABLE "WhatsappQueue" ALTER COLUMN "qrCampaignId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_pending
  ON "WhatsappQueue" (status, "createdAt")
  WHERE status = 'PENDING';
