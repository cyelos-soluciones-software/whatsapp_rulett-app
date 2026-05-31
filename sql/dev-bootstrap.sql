-- Bootstrap mínimo para probar el worker en Docker sin la app principal.
-- Crea tenant/campaña de demo con IDs fijos referenciados por sql/seed.sql.

CREATE TABLE IF NOT EXISTS "Tenant" (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  domain          TEXT NOT NULL,
  "businessEmail" TEXT NOT NULL DEFAULT 'demo@local.dev',
  "businessPhone" TEXT NOT NULL DEFAULT '3000000000',
  "contactFirstName" TEXT NOT NULL DEFAULT 'Demo',
  "contactLastName"  TEXT NOT NULL DEFAULT 'Local',
  "contactPhone"  TEXT NOT NULL DEFAULT '3000000000',
  "contactEmail"  TEXT NOT NULL DEFAULT 'demo@local.dev',
  "maxSedes"      INTEGER NOT NULL DEFAULT 1,
  "maxCoupons"    INTEGER NOT NULL DEFAULT 10,
  "maxQrs"        INTEGER NOT NULL DEFAULT 5,
  "isActive"      BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "QrCampaign" (
  id              TEXT PRIMARY KEY,
  "tenantId"      TEXT NOT NULL REFERENCES "Tenant"(id),
  name            TEXT NOT NULL,
  description     TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "Tenant" (id, name, domain)
VALUES ('dev-tenant-001', 'Tenant Demo Local', 'demo-local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "QrCampaign" (id, "tenantId", name, description)
VALUES ('dev-campaign-001', 'dev-tenant-001', 'Campaña Demo Local', 'Campaña para pruebas del worker')
ON CONFLICT (id) DO NOTHING;
