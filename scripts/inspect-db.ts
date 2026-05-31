import 'dotenv/config';
import { Pool } from 'pg';

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL no está definida');
  return url;
}

function resolveSsl(databaseUrl: string): boolean {
  const explicit = process.env.DATABASE_SSL?.trim().toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  return !/localhost|127\.0\.0\.1/.test(databaseUrl);
}

async function main(): Promise<void> {
  const databaseUrl = resolveDatabaseUrl();
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolveSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('Tablas:', tables.rows.map((r) => r.table_name).join(', '));

    for (const table of ['Tenant', 'QrCampaign', 'WhatsappQueue']) {
      try {
        const sample = await pool.query(`SELECT * FROM "${table}" LIMIT 3`);
        console.log(`\n${table} (muestra):`);
        console.table(sample.rows);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`\n${table}: ${message}`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
