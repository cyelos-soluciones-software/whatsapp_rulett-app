import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { Pool } from 'pg';

interface SeedRow {
  id: string;
  tenantId: string;
  qrCampaignId: string;
  userPhone: string;
  userName: string;
  templateName: string;
  languageCode: string;
}

interface SeedOptions {
  count: number;
  phone?: string;
  template: string;
  language: string;
  tenantId?: string;
  campaignId?: string;
}

const DEV_TENANT_ID = 'dev-tenant-001';
const DEV_CAMPAIGN_ID = 'dev-campaign-001';

function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);
  let count = 3;
  let phone: string | undefined;
  let template = 'hello_world';
  let language = 'es_CO';
  let tenantId: string | undefined;
  let campaignId: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--count' && args[i + 1]) {
      count = Number.parseInt(args[i + 1], 10);
      i += 1;
      continue;
    }

    if (arg === '--phone' && args[i + 1]) {
      phone = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--template' && args[i + 1]) {
      template = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--language' && args[i + 1]) {
      language = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--tenant' && args[i + 1]) {
      tenantId = args[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--campaign' && args[i + 1]) {
      campaignId = args[i + 1];
      i += 1;
    }
  }

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error('--count debe ser un entero positivo');
  }

  return { count, phone, template, language, tenantId, campaignId };
}

async function resolveReferences(
  pool: Pool,
  options: SeedOptions,
): Promise<{ tenantId: string; campaignId: string }> {
  const tenantId =
    options.tenantId?.trim() ||
    process.env.SEED_TENANT_ID?.trim() ||
    undefined;

  const campaignId =
    options.campaignId?.trim() ||
    process.env.SEED_QR_CAMPAIGN_ID?.trim() ||
    undefined;

  if (tenantId && campaignId) {
    return { tenantId, campaignId };
  }

  const tenantResult = await pool.query<{ id: string }>(
    `SELECT id FROM "Tenant" WHERE "isActive" = true ORDER BY "createdAt" ASC LIMIT 1`,
  );

  if (tenantResult.rowCount === 0) {
    return { tenantId: DEV_TENANT_ID, campaignId: DEV_CAMPAIGN_ID };
  }

  const resolvedTenantId = tenantId ?? tenantResult.rows[0].id;

  if (campaignId) {
    return { tenantId: resolvedTenantId, campaignId };
  }

  const campaignResult = await pool.query<{ id: string }>(
    `
    SELECT id
    FROM "QrCampaign"
    WHERE "tenantId" = $1 AND "isActive" = true
    ORDER BY "createdAt" ASC
    LIMIT 1
    `,
    [resolvedTenantId],
  );

  if (campaignResult.rowCount === 0) {
    throw new Error(
      `No hay QrCampaign activa para tenant ${resolvedTenantId}. Usa --campaign o SEED_QR_CAMPAIGN_ID.`,
    );
  }

  return {
    tenantId: resolvedTenantId,
    campaignId: campaignResult.rows[0].id,
  };
}

function buildRows(
  options: SeedOptions,
  refs: { tenantId: string; campaignId: string },
): SeedRow[] {
  const rows: SeedRow[] = [];

  for (let i = 0; i < options.count; i += 1) {
    rows.push({
      id: `seed_${randomUUID()}`,
      tenantId: refs.tenantId,
      qrCampaignId: refs.campaignId,
      userPhone: options.phone ?? `573001234${String(i).padStart(3, '0')}`,
      userName: `Usuario Demo ${i + 1}`,
      templateName: options.template,
      languageCode: options.language,
    });
  }

  return rows;
}

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL no está definida. Copia .env.example a .env');
  }
  return url;
}

function resolveSsl(databaseUrl: string): boolean {
  const explicit = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return !/localhost|127\.0\.0\.1/.test(databaseUrl);
}

async function main(): Promise<void> {
  const options = parseArgs();
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolveSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const refs = await resolveReferences(pool, options);
    const rows = buildRows(options, refs);

    console.log(`Usando tenant=${refs.tenantId} campaign=${refs.campaignId}`);
    const inserted = await pool.query<{
      id: string;
      userPhone: string;
      userName: string;
      templateName: string;
    }>(
      `
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
      SELECT
        r.id,
        r."tenantId",
        r."qrCampaignId",
        r."userPhone",
        r."userName",
        r."templateName",
        r."languageCode",
        'PENDING',
        NOW()
      FROM jsonb_to_recordset($1::jsonb) AS r(
        id text,
        "tenantId" text,
        "qrCampaignId" text,
        "userPhone" text,
        "userName" text,
        "templateName" text,
        "languageCode" text
      )
      RETURNING id, "userPhone", "userName", "templateName"
      `,
      [JSON.stringify(rows)],
    );

    console.log(`Seed completado: ${inserted.rowCount} registro(s) PENDING insertado(s).`);
    for (const row of inserted.rows) {
      console.log(`  - ${row.id} | ${row.userPhone} | ${row.userName} | ${row.templateName}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error en seed: ${message}`);
  process.exit(1);
});
