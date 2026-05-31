-- Datos de ejemplo para probar el worker localmente (Docker bootstrap).
-- Uso: npm run db:seed  |  npm run db:seed:sql

INSERT INTO "WhatsappQueue" (
  id,
  "tenantId",
  "qrCampaignId",
  "userPhone",
  "userName",
  "templateName",
  "languageCode",
  status,
  "updatedAt"
)
VALUES
  ('seed_demo_001', 'dev-tenant-001', 'dev-campaign-001', '573001234567', 'Usuario Demo 1', 'hello_world', 'es_CO', 'PENDING', NOW()),
  ('seed_demo_002', 'dev-tenant-001', 'dev-campaign-001', '573007654321', 'Usuario Demo 2', 'hello_world', 'es_CO', 'PENDING', NOW()),
  ('seed_demo_003', 'dev-tenant-001', 'dev-campaign-001', '573009876543', 'Usuario Demo 3', 'hello_world', 'es_US', 'PENDING', NOW())
ON CONFLICT (id) DO NOTHING;
